import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  PermissionsAndroid,
} from "react-native";
import Constants from "expo-constants";
// NativeModules for SMS reading
import { NativeModules } from "react-native";

// For Android SMS reading
const SmsAndroid = NativeModules.SmsAndroid;
import FABAnim from "../../assets/FAB-animation.json";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import LottieView from "lottie-react-native";

// ---- Types ---------------------------------------------------------------
type Receipt = {
  city: string;
  company: string;
  createdDate: string; // ISO string
  file: string;        // receipt id
  total: number;
};

type Section = {
  title: string;
  data: Receipt[];
  sum: number;
};

// ---- Helpers -------------------------------------------------------------
const nis = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" });

function normalizeToMidnight(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getDayLabel(iso: string) {
  const today = normalizeToMidnight(new Date());
  const yest  = normalizeToMidnight(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const d = normalizeToMidnight(new Date(iso));
  if (d.getTime() === today.getTime()) return "היום";
  if (d.getTime() === yest.getTime())  return "אתמול";
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function groupByCompanyCity(receipts: Receipt[]): Section[] {
  const sorted = [...receipts].sort(
    (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

  const map = new Map<string, Receipt[]>();
  for (const r of sorted) {
    const label = `${r.company} – ${r.city}`;
    const arr = map.get(label) ?? [];
    arr.push(r);
    map.set(label, arr);
  }

  return Array.from(map.entries()).map(([title, data]) => ({
    title,
    data,
    sum: data.reduce((acc, r) => acc + r.total, 0),
  }));
}

// ---- UI ------------------------------------------------------------------

export default function ReceiptsPage() {
  // FAB & Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [loadingSms, setLoadingSms] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [showRefreshLottie, setShowRefreshLottie] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [snack, setSnack] = useState<string | null>(null);
  const [showSuccessSplash, setShowSuccessSplash] = useState(false);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [foundLinks, setFoundLinks] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For showing the most recent OSHERAD SMS
  const [recentOsheradSms, setRecentOsheradSms] = useState<string | null>(null);

  // Expo Go vs Dev/Standalone
  const isExpoGo = Constants.appOwnership === "expo";

  // Extract links from text
  const extractLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches || [];
  };

  // Handle text input change
  const handleTextChange = (text: string) => {
    setTextValue(text);
    const links = extractLinks(text);
    setFoundLinks(links);
    setPermissionError(null);
  };

  // Submit link to API
  const submitLink = async (url: string) => {
    setIsSubmitting(true);
    setModalVisible(false); // Hide modal to show loading animation

    try {
      const response = await fetch("https://zenlist.hack-ops.net/api/fetchReceipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: String(url) }),
      });

      const responseBody = await response.text();
      let errorMessage = "";

      if (!response.ok) {
        if (responseBody.includes("already exists")) {
          errorMessage = "הקישור כבר קיים במערכת";
        } else {
          errorMessage = `שגיאה בשרת: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Show success animation
      setIsSubmitting(false);
      setShowSuccessSplash(true);

      // Wait for success animation then show snackbar
      setTimeout(() => {
        setShowSuccessSplash(false);
        showSnack("הקבלה נוספה בהצלחה!");
      }, 2000);

      await load(); // Reload receipts after successful submission
      setTextValue("");
      setFoundLinks([]);
    } catch (e: any) {
      showSnack(e.message || "אירעה שגיאה בעיבוד הקבלה");
      // Reopen modal with error after a short delay
      setTimeout(() => {
        setModalVisible(true);
        setPermissionError(e.message || "אירעה שגיאה בעיבוד הקבלה");
      }, 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ask READ_SMS only in dev/standalone builds (Expo Go can't use it anyway)
  const ensureSmsPermission = useCallback(async () => {
    if (Platform.OS !== "android" || isExpoGo) return false;
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: "גישה ל-SMS",
          message: "נדרש לאיתור קבלות מתוך הודעות ה-SMS.",
          buttonPositive: "אישור",
          buttonNegative: "ביטול",
        }
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, [isExpoGo]);

  // Handle FAB press
  const handleFabPress = useCallback(async () => {
    console.log("FAB pressed");

    if (Platform.OS === "android" && isExpoGo) {
      Alert.alert(
        "הרשאת קריאת SMS אינה זמינה",
        "ב-Expo Go לא ניתן לבקש הרשאת קריאת SMS או לקרוא הודעות. השתמש בבילד פיתוח (Development Build) או הדבק קישור.",
        [{ text: "הבנתי", onPress: () => console.log("User acknowledged SMS permission limitation") }]
      );
      console.log("SMS permission request blocked: Expo Go limitation");
    } else if (Platform.OS === "android" && !isExpoGo) {
      // Non-blocking: ask once, continue regardless (paste-link flow still works)
      const granted = await ensureSmsPermission();
      if (!granted) {
        console.log("READ_SMS not granted; continuing with paste-link modal");
      } else {
        // Try to read SMS from OSHERAD
        try {
          if (SmsAndroid && SmsAndroid.list) {
            console.log("Attempting to read SMS from OSHERAD...");
            SmsAndroid.list(
              JSON.stringify({
                box: 'inbox',
                address: 'OSHERAD',
                maxCount: 10,
              }),
              (fail: any) => {
                console.log('Failed to read SMS:', fail);
                setRecentOsheradSms(null);
              },
              (count: number, smsList: string) => {
                try {
                  const arr = JSON.parse(smsList);
                  console.log('OSHERAD SMS messages:', arr);
                  if (arr && arr.length > 0) {
                    setRecentOsheradSms(arr[0].body);
                  } else {
                    setRecentOsheradSms(null);
                  }
                } catch (e) {
                  console.log('Error parsing SMS list:', e);
                  setRecentOsheradSms(null);
                }
              }
            );
          } else {
            console.log('SmsAndroid.list not available');
            setRecentOsheradSms(null);
          }
        } catch (e) {
          console.log('Exception reading SMS:', e);
          setRecentOsheradSms(null);
        }
      }
    }

    setModalVisible(true);
    console.log("Modal opened");
    setTextValue("");
    setFoundLinks([]);
    setPermissionError(null);
    console.log("State reset for modal");
  }, [ensureSmsPermission, isExpoGo]);

  const showSnack = useCallback((msg: string) => {
    setSnack(msg);
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("https://zenlist.hack-ops.net/api/receipts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Receipt[] = await res.json().catch(() => []);
      setReceipts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError("שגיאה בטעינת הקבלות. נסה שוב.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setShowRefreshLottie(true);
    await load();
    setTimeout(() => {
      setShowRefreshLottie(false);
      setRefreshing(false);
    }, 2500);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  // cleanup the snackbar timer
  useEffect(() => {
    return () => {
      if (snackTimer.current) clearTimeout(snackTimer.current);
    };
  }, []);

  const sections = useMemo(() => groupByCompanyCity(receipts), [receipts]);

  // ---- Render states -----------------------------------------------------
  if (isLoading || (isRefreshing && showRefreshLottie)) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>קבלות</Text>
            <LottieView
              source={require("../../assets/receipts-navbar-animation.json")}
              autoPlay
              loop
              style={{ width: 60, height: 60, marginBottom: 0 }}
            />
          </View>
        </View>
        <View style={styles.center}>
          <LottieView
            source={require("../../assets/raise-animation.json")}
            autoPlay
            speed={1.3}
            loop
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.loadingText}>טוען את הקבלות…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderLoadingOverlay = () => (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, backgroundColor: "#f0ecd8ff" }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>קבלות</Text>
            <LottieView
              source={require("../../assets/receipts-navbar-animation.json")}
              autoPlay
              loop
              style={{ width: 60, height: 60, marginBottom: 0 }}
            />
          </View>
        </View>
        <View style={styles.center}>
          <LottieView
            source={require("../../assets/raise-animation.json")}
            autoPlay
            speed={1.3}
            loop
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.loadingText}>מעבד את הקבלה...</Text>
        </View>
      </SafeAreaView>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>קבלות</Text>
          <LottieView
            source={require("../../assets/receipts-navbar-animation.json")}
            autoPlay
            loop
            style={{ width: 60, height: 60, marginBottom: 0 }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#506c4fff" />
          <Text style={styles.loadingText}>טוען את הקבלות…</Text>
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryBtnText}>רענן</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={40} color="#506c4fff" />
          <Text style={styles.emptyTitle}>אין קבלות להצגה</Text>
          <Text style={styles.emptySubtitle}>כשתעלה קבלות חדשות — הן יופיעו כאן.</Text>
        </View>
      ) : (
        <SectionList
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item.file}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#506c4fff" />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSum}>{nis.format(section.sum)}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ReceiptRow item={item} onDownload={showSnack} setShowSuccessSplash={setShowSuccessSplash} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
          removeClippedSubviews
          initialNumToRender={12}
          windowSize={10}
        />
      )}

      {snack ? (
        <View style={styles.snack}>
          <Text style={styles.snackText}>{snack}</Text>
        </View>
      ) : null}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleFabPress} activeOpacity={0.8}>
        <LottieView source={FABAnim} autoPlay loop style={{ width: "100%", height: "100%" }} />
      </TouchableOpacity>

      {/* Modal for pasting OSHERAD message */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Show most recent OSHERAD SMS if available */}
            {recentOsheradSms && (
              <View style={{ marginBottom: 12, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10 }}>
                <Text style={{ color: '#506c4fff', fontWeight: '700', marginBottom: 4 }}>הודעה אחרונה מ-OSHERAD:</Text>
                <Text style={{ color: '#333', fontSize: 15 }}>{recentOsheradSms}</Text>
              </View>
            )}
            <Text style={styles.modalTitle}>הדבק הודעה מ-OSHERAD</Text>
            {permissionError ? <Text style={styles.permissionError}>{permissionError}</Text> : null}
            <TextInput
              style={styles.bigTextBox}
              multiline
              value={textValue}
              onChangeText={handleTextChange}
              placeholder="הדבק כאן את ההודעה..."
              editable={!isSubmitting}
              textAlign="right"
            />
            {foundLinks.length > 0 && (
              <ScrollView style={styles.linksList}>
                {foundLinks.map((link, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.linkItem}
                    onPress={() => submitLink(link)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.linkText} numberOfLines={1}>
                      {link}
                    </Text>
                    {isSubmitting && <ActivityIndicator size="small" color="#506c4fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => {
                setModalVisible(false);
                setTextValue("");
                setFoundLinks([]);
              }}
            >
              <Text style={styles.closeModalBtnText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success animation overlay */}
      {showSuccessSplash && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 9999, elevation: 9999, position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
          ]}
        >
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f0ecd8ff" }}>
            <LottieView
              source={require("../../assets/download-success-animation.json")}
              autoPlay
              loop={false}
              speed={1.3}
              style={{ width: 220, height: 220 }}
            />
          </View>
        </View>
      )}

      {/* Loading animation overlay */}
      {isSubmitting && renderLoadingOverlay()}
    </SafeAreaView>
  );
}

// ---- Row component -------------------------------------------------------
function ReceiptRow({
  item,
  onDownload,
  setShowSuccessSplash,
}: {
  item: Receipt;
  onDownload: (msg: string) => void;
  setShowSuccessSplash: (v: boolean) => void;
}) {
  const date = new Date(item.createdDate);

  const handleDownload = async () => {
    try {
      setShowSuccessSplash(true);
      const downloadUrl = `https://zenlist.hack-ops.net/api/receipts/${item.file}/download`;
      const fileName = `${item.company}-${item.city}-${item.file}.pdf`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);
      if (downloadResult.status === 200) {
        onDownload("הקבלה הורדה בהצלחה!");
        await Sharing.shareAsync(downloadResult.uri);
      } else {
        onDownload("שגיאה בהורדת הקבלה.");
      }
    } catch (error) {
      console.error(error);
      onDownload("שגיאה בהורדת הקבלה.");
    } finally {
      setTimeout(() => setShowSuccessSplash(false), 1200);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.995 }], opacity: 0.96 },
      ]}
      onPress={() => {
        // define card press behavior if needed
      }}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.company}>{item.company}</Text>
          <Text style={styles.meta}>{item.city}</Text>
        </View>
        <Text style={styles.amount}>{nis.format(item.total)}</Text>
        <Pressable onPress={handleDownload} style={[styles.downloadButton, { marginLeft: 1 }]}>
          <LottieView
            source={require("../../assets/download.json")}
            autoPlay
            loop
            speed={1.4}
            style={{ width: 42, height: 42 }}
          />
        </Pressable>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.badge}>
          <Ionicons name="document-text-outline" size={14} color="#506c4fff" />
          <Text style={styles.badgeText}>#{item.file}</Text>
        </View>
        <Text style={styles.dateText}>
          {date.toLocaleDateString("he-IL", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}{" "}
          {date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </Pressable>
  );
}

// ---- Styles --------------------------------------------------------------
const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 28,
    right: 28,
    backgroundColor: "#506c4fff",
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    zIndex: 10,
  },
  linksList: {
    maxHeight: 150,
    marginVertical: 10,
  },
  linkItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
  },
  linkText: {
    color: "#506c4fff",
    flex: 1,
    marginRight: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fffdefff",
    borderRadius: 18,
    padding: 24,
    width: "90%",
    maxWidth: 420,
    alignItems: "stretch",
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: "center",
    marginBottom: 18,
  },
  bigTextBox: {
    minHeight: 120,
    maxHeight: 220,
    borderColor: "#e0e0e0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    color: "#0f0e0eff",
    backgroundColor: "#fff",
    marginBottom: 18,
    textAlign: "right",
  },
  closeModalBtn: {
    backgroundColor: "#506c4fff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  closeModalBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  permissionError: {
    color: "#B91C1C",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 10,
  },
  screen: {
    flex: 1,
    backgroundColor: "#f0ecd8ff",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 25 : 0,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 40,
    paddingBottom: 24,
    marginBottom: 8,
    backgroundColor: "#f0ecd8ff",
  },
  titleContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-end",
    paddingRight: 16,
    gap: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: "right",
  },
  titleEmoji: { fontSize: 32 },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#506c4fff",
    marginBottom: 8,
  },
  skeletonCard: {
    height: 84,
    alignSelf: "stretch",
    backgroundColor: "#fffbe4ff",
    borderRadius: 16,
    marginTop: 8,
    opacity: 0.6,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#506c4fff",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: "#506c4fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  retryBtnText: { color: "#fff", fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#506c4fff",
  },
  sectionSum: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0011ffff",
    opacity: 0.9,
  },
  card: {
    backgroundColor: "#fffdefff",
    borderRadius: 5,
    padding: 16,
    shadowColor: "#545353ff",
    shadowOpacity: 0.02,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0.5,
  },
  cardTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  company: {
    textAlign: "right",
    fontSize: 16,
    fontWeight: "800",
    color: "#3f3f3fff",
  },
  meta: {
    textAlign: "right",
    fontSize: 12,
    color: "#64748B",
  },
  amount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#506c4fff",
    marginLeft: 8,
  },
  cardBottom: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8E8E8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: "#506c4fff",
    fontSize: 12,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 12,
    color: "#64748B",
  },
  downloadButton: {},
  snack: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  snackText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
