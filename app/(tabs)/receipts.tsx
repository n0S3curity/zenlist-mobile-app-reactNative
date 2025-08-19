import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  SafeAreaView,
  SectionList,
  SectionListData,
  StatusBar,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

  // e.g. "יום שני, 13 באוגוסט"
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
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [receipts, setReceipts]     = useState<Receipt[]>([]);
  const [snack, setSnack] = useState<string | null>(null);
  const snackTimer = React.useRef<NodeJS.Timeout | null>(null);

  const showSnack = useCallback((msg: string) => {
    setSnack(msg);
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 2200) as unknown as NodeJS.Timeout;
  }, []);


  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("https://zenlist.hack-ops.net/api/receipts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Receipt[] = await res.json();
      setReceipts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError("שגיאה בטעינת הקבלות. נסה שוב.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    // ensure RTL layout if device is LTR
    if (!I18nManager.isRTL) {
      // You can skip forcing RTL; RN mirrors correctly with he-IL text.
      // If you *must* force RTL globally, do it at app bootstrap (not here).
    }
    load();
  }, [load]);

 const sections = useMemo(() => groupByCompanyCity(receipts), [receipts]);


  // ---- Render states -----------------------------------------------------
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>קבלות</Text>
          <Text style={styles.titleEmoji}>🧾</Text>
        </View>
      </View>
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#506c4fff" />
          <Text style={styles.loadingText}>טוען את הקבלות…</Text>
          {/* subtle skeletons */}
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
          renderItem={({ item }) => <ReceiptRow item={item} onDownload={showSnack} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
      {snack ? (
        <View style={styles.snack}>
          <Text style={styles.snackText}>{snack}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---- Row component -------------------------------------------------------
function ReceiptRow({ item, onDownload }: { item: Receipt, onDownload: (msg: string) => void }) {
  const date = new Date(item.createdDate);

  const handleDownload = async () => {
    try {
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
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.995 }], opacity: 0.96 },
      ]}
      onPress={() => {
        // Here you can define what happens when the user presses the card
      }}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.company}>{item.company}</Text>
          <Text style={styles.meta}>{item.city}</Text>
        </View>
        <Text style={styles.amount}>{nis.format(item.total)}</Text>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.badge}>
          <Ionicons name="document-text-outline" size={14} color="#506c4fff" />
          <Text style={styles.badgeText}>#{item.file}</Text>
        </View>
        <Pressable onPress={handleDownload} style={styles.downloadButton}>
          <Ionicons name="download-outline" size={20} color="#506c4fff" />
        </Pressable>
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-end',
    paddingRight: 16,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: 'right',
  },
  titleEmoji: {
    fontSize: 32,
  },
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
    color: '#3f3f3fff',
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
  downloadButton: {
    // Add any specific styles for the download button here if needed
  },
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
