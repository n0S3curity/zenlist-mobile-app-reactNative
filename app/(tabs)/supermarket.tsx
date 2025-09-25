import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Force right-to-left layout for Hebrew
I18nManager.forceRTL(true);
I18nManager.allowRTL(true);

// ---------- Types ----------
type SupermarketItem = {
  ItemCode?: string;
  ItemName?: string;
  ManufacturerName?: string;
  ItemPrice?: string | number;
  promo?: {
    DiscountedPrice: string | number;
    DiscountedPricePerMida?: string | number;
    MinQty: string | number;
    PromotionDescription?: string;
    PromotionUpdateDate?: string;
    PromotionEndDate?: string;
  };
  Promo?: {
    Quantity: number;
    Price: number;
    Description?: string;
  } | null;
  Offers?: { item: SupermarketItem; supermarket: string; branch: string; promo?: any }[];
  [key: string]: any;
};

type SupermarketPlace = {
  Name?: string;
  supermarket_name?: string;
  yohananof?: { StoreName: string };
  Root?: {
    Items?: {
      Item: SupermarketItem[] | SupermarketItem;
    };
  };
};

// ---------- UI Helpers ----------
const nis = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" });

function normalizeText(v: string) {
  return (v ?? "").toString().trim().toLowerCase();
}

// A new helper function to determine the final price of an item
const getFinalPrice = (item: SupermarketItem): number => {
  const itemPrice = parseFloat(item.ItemPrice as string);
  const promoPrice = item.promo ? parseFloat(item.promo.DiscountedPrice as string) : Infinity;
  return Math.min(itemPrice, promoPrice);
};

// ---------- Supermarket Name Translation ----------
function translateSupermarket(name: string) {
  if (!name) return "";
  const n = name.trim().toLowerCase();
  if (n.includes("yohananof")) return "יוחננוף";
  if (n.includes("osherad")) return "אושר עד";
  if (n.includes("rami levi")) return "רמי לוי";
  return name;
}

// ---------- Screen ----------
export default function SupermarketPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SupermarketItem[]>([]);
  const [query, setQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SupermarketItem | null>(null);
  const [selectedOffers, setSelectedOffers] = useState<any[]>([]);

  // load data
  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("https://zenlist.hack-ops.net/api/prices");
      // const res = await fetch("http://192.168.3.23:5000/api/prices");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SupermarketPlace[] = await res.json();

      const itemMap = new Map<
        string,
        { item: SupermarketItem; supermarket: string; branch: string; promo?: any }[]
      >();

      data.forEach((supermarket) => {
        const name = supermarket.supermarket_name || supermarket.Name || "";
        const branch = supermarket.yohananof?.StoreName || "";
        
        // Fix: Check if `Item` is an array or a single object
        const itemsData = supermarket.Root?.Items?.Item;
        const itemsArr = Array.isArray(itemsData) ? itemsData : (itemsData ? [itemsData] : []);

        itemsArr.forEach((item: SupermarketItem) => {
          if (!item.ItemCode) return;
          if (!itemMap.has(item.ItemCode)) itemMap.set(item.ItemCode, []);
          
          let promo = undefined;
          if (item.promo) {
            promo = {
              DiscountedPrice: item.promo.DiscountedPrice,
              MinQty: item.promo.MinQty,
              PromotionDescription: item.promo.PromotionDescription,
              DiscountedPricePerMida: item.promo.DiscountedPricePerMida,
              PromotionEndDate: item.promo.PromotionEndDate,
            };
          }
          
          itemMap.get(item.ItemCode)!.push({
            item,
            supermarket: name,
            branch,
            promo,
          });
        });
      });

      const uniqueItems: SupermarketItem[] = [];
      itemMap.forEach((offers) => {
        const main = { ...offers[0].item, Offers: offers };
        uniqueItems.push(main);
      });
      setItems(uniqueItems);
    } catch (e: any) {
      console.error(e);
      setError("שגיאה בטעינת מחירים. נסה שוב.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return items;
    return items.filter((item) => {
      const name = normalizeText(item.ItemName ?? "");
      const code = normalizeText(item.ItemCode ?? "");
      return name.includes(q) || code.includes(q);
    });
  }, [items, query]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#506c4fff" />
        <Text style={styles.loadingText}>טוען נתונים...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Main ----------
  return (
    <SafeAreaView style={styles.screen} onTouchStart={() => Keyboard.dismiss()}>
      {/* Header with search bar */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>סופרמרקט</Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="חפש לפי שם או קוד…"
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
        keyExtractor={(item, i) => `${item.ItemCode ?? i}`}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="transparent" />
        }
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => (
          <SupermarketCard
            item={item}
            onPress={() => {
              setSelectedItem(item);
              setSelectedOffers(item.Offers || []);
              setModalVisible(true);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={40} color="#506c4fff" />
            <Text style={styles.emptyTitle}>לא נמצאו פריטים תואמים</Text>
            <Text style={styles.emptySub}>נסה/י חיפוש אחר.</Text>
          </View>
        }
      />

      {/* Modal for item details */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {selectedItem?.ItemName ?? "—"}
              </Text>
              <Text style={styles.modalLabel}>
                קוד פריט: <Text style={styles.modalValue}>{selectedItem?.ItemCode ?? "—"}</Text>
              </Text>
              <Text style={[styles.modalLabel, { marginTop: 12, fontWeight: "bold" }]}>פרטים</Text>
              {selectedOffers.map((offer, idx) => (
                <ModalOfferRow offer={offer} key={offer.supermarket + offer.branch + idx} />
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeModalBtnText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------- Card ----------
function SupermarketCard({
  item,
  onPress,
}: {
  item: SupermarketItem;
  onPress: () => void;
}) {
  let offers = item.Offers || [];
  const isSingle = offers.length === 1;
  const isScrollable = offers.length > 2;

  const cheapestPrice = useMemo(() => {
    if (offers.length === 0) return Infinity;
    return offers.reduce((min, offer) => {
      const currentPrice = getFinalPrice(offer.item);
      return Math.min(min, currentPrice);
    }, Infinity);
  }, [offers]);

  if (offers.length > 1) {
    offers = [...offers].sort((a, b) => {
      return getFinalPrice(a.item) - getFinalPrice(b.item);
    });
  }

  const displayOffers = isScrollable ? [...offers].reverse() : offers;

  const OffersContent = (
    <>
      {displayOffers.map((offer, idx) => {
        const finalPrice = getFinalPrice(offer.item);
        const isCheapest = finalPrice === cheapestPrice;

        const price =
          typeof offer.item.ItemPrice === "number"
            ? nis.format(offer.item.ItemPrice)
            : offer.item.ItemPrice
              ? `${offer.item.ItemPrice} ₪`
              : "—";
        const hasPromo = !!offer.item.promo && !!offer.item.promo.DiscountedPrice;
        const widthStyle = isSingle
          ? { flex: 1 }
          : isScrollable
            ? { width: 160, minWidth: 140, maxWidth: 200 }
            : { flex: 1 / offers.length, minWidth: 0, maxWidth: `${100 / offers.length}%` };
        return (
          <View
            key={offer.supermarket + offer.branch + idx}
            style={[
              styles.offerFrame,
              widthStyle,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            <Text
              style={[
                styles.offerSupermarket,
                { alignSelf: "center", textAlign: "center" }
              ]}
            >
              {translateSupermarket(offer.supermarket)}
              {offer.branch ? ` - ${offer.branch}` : ""}
            </Text>
            {isCheapest && (
              <Text style={styles.cheapestTag}>הכי זול ⭐</Text>
            )}
            <View style={[styles.pricePromoRow, { justifyContent: "center" }]}>
              <Text style={hasPromo ? styles.originalPrice : styles.offerPrice}>{price}</Text>
              {hasPromo && (
                <Text style={styles.discountedPrice}>
                  {nis.format(Number(offer.item.promo.DiscountedPrice))}
                </Text>
              )}
            </View>
            {hasPromo && (
              <View style={styles.promoFrame}>
                <Text style={styles.promoTitle}>במבצע</Text>
                <Text style={styles.promoDetail}>
                  {offer.item.promo.PromotionDescription ?? "—"}
                </Text>
                <Text style={styles.promoDetail}>
                  שווי ליחידה: {offer.item.promo.DiscountedPricePerMida ? nis.format(Number(offer.item.promo.DiscountedPricePerMida)) : "—"}
                </Text>
                <Text style={styles.promoDetail}>
                  כמות: {offer.item.promo.MinQty ?? "—"}
                </Text>
                <Text style={styles.promoDetail}>
                  תוקף: {offer.item.promo.PromotionEndDate
                    ? new Date(offer.item.promo.PromotionEndDate).toLocaleDateString("he-IL")
                    : "—"}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </>
  );

  return (
    <View style={styles.card}>
      <View style={[styles.cardContentBig, { alignItems: "center" }]}>
        <Text style={styles.productName}>{item.ItemName ?? "—"}</Text>
        <Text style={styles.productMeta}>
          קוד פריט: {item.ItemCode ?? "—"}
        </Text>
        {isScrollable ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.offersRowScrollable, { flexDirection: "row-reverse" }]}
            directionalLockEnabled
            alwaysBounceHorizontal
            keyboardShouldPersistTaps="handled"
            style={{ direction: "rtl" }}
          >
            {OffersContent}
          </ScrollView>
        ) : (
          <Pressable
            style={[styles.offersRow, isSingle && { flexDirection: "row-reverse" }, { justifyContent: "center", alignItems: "center" }]
            }
            onPress={onPress}
            android_ripple={{ color: "#e6f9e6" }}
          >
            {OffersContent}
          </Pressable>
        )}
      </View>
      {!isScrollable && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onPress}
          android_ripple={{ color: "#e6f9e6" }}
        />
      )}
    </View>
  );
}

// ---------- Modal Offer Row ----------
function ModalOfferRow({ offer }: { offer: any }) {
  const price =
    typeof offer.item.ItemPrice === "number"
      ? nis.format(offer.item.ItemPrice)
      : offer.item.ItemPrice
        ? `${offer.item.ItemPrice} ₪`
        : "—";
  const hasPromo = !!offer.item.promo && !!offer.item.promo.DiscountedPrice;
  return (
    <View style={styles.offerRow}>
      <Text style={styles.offerSupermarket}>
        {translateSupermarket(offer.supermarket)}
        {offer.branch ? ` - ${offer.branch}` : ""}
      </Text>
      <View style={styles.pricePromoRow}>
        <Text style={hasPromo ? styles.originalPrice : styles.offerPrice}>{price}</Text>
        {hasPromo && (
          <Text style={styles.discountedPrice}>
            {nis.format(Number(offer.item.promo.DiscountedPrice))}
          </Text>
        )}
      </View>
      {hasPromo && (
        <View style={styles.promoFrameModal}>
          <Text style={styles.promoTitle}>מבצע</Text>
          <Text style={styles.promoDetail}>
            {offer.item.promo.PromotionDescription ? offer.item.promo.PromotionDescription : ""}
          </Text>
          <Text style={styles.promoDetail}>
            כמות במבצע: {offer.item.promo.MinQty ?? "—"}
          </Text>
          <Text style={styles.promoDetail}>
            בתוקף עד:{" "}
            {offer.item.promo.PromotionEndDate
              ? new Date(offer.item.promo.PromotionEndDate).toLocaleDateString("he-IL")
              : "—"}
          </Text>
        </View>
      )}
    </View>
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
    fontSize: 36,
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: 'right',
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
    borderRadius: 12,
    padding: 18,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginBottom: 10,
    marginHorizontal: 0,
  },
  cardContentBig: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  productDetails: {
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 2,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#506c4fff',
    textAlign: 'center',
    marginBottom: 2,
  },
  productMeta: {
    fontSize: 14,
    color: "#999",
    textAlign: 'center',
    marginBottom: 4,
  },
  offersRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'nowrap',
    width: "100%",
    gap: 0,
    marginTop: 8,
    justifyContent: 'center',
  },
  offersRowScrollable: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: 0,
    paddingBottom: 2,
    marginTop: 8,
  },
  offerFrame: {
    backgroundColor: "#f6fff6",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#34c759",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginLeft: 6,
    marginRight: 0,
    marginBottom: 0,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    maxWidth: "100%",
  },
  offerSupermarket: {
    fontWeight: "700",
    color: "#228B22",
    fontSize: 15,
    marginBottom: 2,
    textAlign: "center",
    alignSelf: "center",
    flexShrink: 1,
  },
  pricePromoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  offerPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    textAlign: "left",
  },
  originalPrice: {
    fontSize: 15,
    color: "#b0b0b0",
    textDecorationLine: "line-through",
    marginLeft: 4,
    marginRight: 2,
    fontWeight: "500",
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#228B22",
    marginRight: 2,
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
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: "center",
    marginBottom: 18,
  },
  modalLabel: {
    fontSize: 16,
    color: "#333",
    marginBottom: 6,
    textAlign: "right",
  },
  modalValue: {
    fontWeight: "700",
    color: "#506c4fff",
  },
  closeModalBtn: {
    backgroundColor: "#506c4fff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  closeModalBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  promoFrame: {
    backgroundColor: "#e6f9e6",
    borderColor: "#34c759",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginTop: 4,
    textAlign: "right",
    alignItems: "flex-end",
    alignSelf: "center",
  },
  promoFrameModal: {
    backgroundColor: "#e6f9e6",
    borderColor: "#34c759",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginTop: 4,
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  promoTitle: {
    color: "#228B22",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 1,
    textAlign: "right",
  },
  promoDetail: {
    color: "#228B22",
    fontSize: 12,
    textAlign: "right",
    alignItems: "flex-end"
  },
  offerRow: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 6,
  },
  cheapestTag: {
    backgroundColor: "#34c759",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
    marginRight: 2,
    overflow: "hidden",
    textAlign: "center",
  },
});
