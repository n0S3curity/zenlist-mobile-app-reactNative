import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";

// ---------- Types ----------
type Product = {
  id?: string | number;
  name?: string;
  barcode?: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  size?: string;
  average_price?: number;
};

// ---------- UI Helpers ----------
const nis = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" });

function normalizeText(v: string) {
  return (v ?? "").toString().trim().toLowerCase();
}

// ---------- Screen ----------
export default function ProductsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [showRefreshLottie, setShowRefreshLottie] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [snack, setSnack] = useState<string | null>(null);
  const snackTimer = useRef<NodeJS.Timeout | null>(null);

  // load data
  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("https://zenlist.hack-ops.net/api/products");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const productsArray = Object.values(data);
      setItems(productsArray as Product[]);
    } catch (e: any) {
      setError("שגיאה בטעינת מוצרים. נסה שוב.");
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
    }, 2000);
  }, [load]);

  useEffect(() => {
    if (!I18nManager.isRTL) {
      // We keep natural device direction; Hebrew text renders fine.
    }
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return items;
    return items.filter((p) => {
      const name = normalizeText(p.name ?? "");
      const code = normalizeText(p.barcode ?? "");
      return name.includes(q) || code.includes(q);
    });
  }, [items, query]);

  const showSnack = useCallback((msg: string) => {
    setSnack(msg);
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 2200) as unknown as NodeJS.Timeout;
  }, []);

  // ---------- Render states ----------
  if (isLoading || (isRefreshing && showRefreshLottie)) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>מוצרים</Text>
            <LottieView
                                  source={require('../../assets/BarcodeScanner.json')}
                                  autoPlay
                                  loop
                                  style={{ width: 32, height: 32 }}
                                />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="חפש לפי שם או ברקוד…"
            placeholderTextColor="#808080"
            style={styles.input}
            textAlign="right"
            returnKeyType="search"
          />
        </View>
        <View style={styles.loadingWrap}>
          <LottieView
            source={require('../../assets/raise-animation.json')}
            autoPlay
            loop={true}
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.loadingText}>טוען מוצרים…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>מוצרים</Text>
            <LottieView
              source={require('../../assets/BarcodeScanner.json')}
              autoPlay
              loop
              style={{ width: 32, height: 32 }}
            />
          </View>
        </View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryBtnText}>רענן</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Main ----------
  return (
    <SafeAreaView style={styles.screen} onTouchStart={() => Keyboard.dismiss()}>
      {/* Header with search bar */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>מוצרים</Text>
           <LottieView
                                  source={require('../../assets/BarcodeScanner.json')}
                                  autoPlay
                                  loop
                                  style={{ width: 36, height: 36 }}
                                />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="חפש לפי שם או ברקוד…"
          placeholderTextColor="#808080"
          style={styles.input}
          textAlign="right"
          returnKeyType="search"
        />
      </View>

      {/* List */}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item, i) => `${item.id ?? item.barcode ?? i}`}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="transparent" />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <ProductCard product={item} onToast={showSnack} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={40} color="#506c4fff" />
            <Text style={styles.emptyTitle}>לא נמצאו מוצרים תואמים</Text>
            <Text style={styles.emptySub}>נסה/י חיפוש אחר.</Text>
          </View>
        }
      />

      {/* Snackbar */}
      {snack ? (
        <View style={styles.snack}>
          <Text style={styles.snackText}>{snack}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------- Product Card Component with Navigation ----------
function ProductCard({ product, onToast }: { product: Product; onToast: (m: string) => void }) {
  const router = useRouter();
  const name = product.name ?? "מוצר ללא שם";
  const brand = product.brand ?? "";
  const code = product.barcode ?? "";
  const priceToDisplay = typeof product.average_price === "number" ? product.average_price : product.price;
  const priceText = typeof priceToDisplay === "number" && !isNaN(priceToDisplay) ? nis.format(priceToDisplay) : "—";
  const showAveragePriceLabel = typeof product.average_price === "number";

  const handlePress = () => {
    router.push({
      pathname: "/product-stats",
      params: { barcode: product.barcode },
    });
    onToast(`נבחר: ${name}${code ? ` • ${code}` : ""}`);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.995 }], opacity: 0.96 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.cardContent}>
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{name}</Text>
          <Text style={styles.productMeta}>
            {brand}
            {brand && code ? " • " : ""}
            {code}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.productPrice}>{priceText}</Text>
          {showAveragePriceLabel && (
            <Text style={styles.averagePriceLabel}>מחיר ממוצע</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0ecd8ff",
    paddingTop: Platform.OS === "android" ? 25 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 40, // Increased top padding
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
    gap: 8, // Gap between title and icon
  },
  title: {
    fontSize: 36, // Increased font size
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: 'right', // Aligned to top right
  },
  titleEmoji: {
    fontSize: 25,
  },
  input: {
    alignSelf: "stretch",
    backgroundColor: "#fffdefff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    textAlign: "right",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    color: "#506c4fff",
  },
  skeletonCard: {
    height: 100,
    alignSelf: "stretch",
    backgroundColor: "#fffef6ff",
    borderRadius: 16,
    marginHorizontal: 0,
    opacity: 0.6,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 18,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: "#506c4fff",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 15,
    color: "#666",
    textAlign: 'center',
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
  cardContent: {
    flexDirection: 'row-reverse', // Align items horizontally
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productDetails: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  averagePriceLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: 'left',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#506c4fff',
    textAlign: 'left',
  },
  productMeta: {
    fontSize: 14,
    color: "#999",
    textAlign: 'right',
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
