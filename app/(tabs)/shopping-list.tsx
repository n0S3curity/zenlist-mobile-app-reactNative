import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  I18nManager,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  View,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';

// ---------- Types ----------
type ListItem = {
  id: string;
  name: string;
  quantity: number;
  category: string;
  done: boolean;
};

// ---------- API Endpoint ----------
const listApi = "https://zenlist.hack-ops.net/api/list";

// ---------- Screen Component ----------
export default function ShoppingListPage() {
  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);

  // UI feedback state
  const [snack, setSnack] = useState<string | null>(null);
  const snackTimer = useRef<NodeJS.Timeout | null>(null);

  // UI state for list sections
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Function to show a temporary snackbar message
  const showSnack = useCallback((msg: string) => {
    setSnack(msg);
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 2200) as unknown as NodeJS.Timeout;
  }, []);

  // Function to fetch the shopping list from the API
  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(listApi);
      if (!res.ok) throw new Error(`שגיאת שרת: ${res.status}`);
      const data = await res.json();

      const itemsArray = Object.values(data).filter(
        (item): item is ListItem => typeof item === 'object' && item !== null && 'id' in item
      );

      // Collapse all categories by default on load
      const allCategories = new Set(itemsArray.map(item => item.category || 'כללי'));
      setCollapsedCategories(allCategories);

      setItems(itemsArray);
    } catch (e: any) {
      setError("שגיאה בטעינת רשימת הקניות. נסה שוב.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler for pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setShowRefreshLottie(true);

    // Load data in background while animation plays
    await load();

    // Wait for animation to complete
    setTimeout(() => {
      setShowRefreshLottie(false);
      setRefreshing(false);
    }, 7000);
  }, [load]);

  // Initial load effect
  useEffect(() => {
    load();
  }, [load]);

  // API call to toggle an item's 'done' status
  const toggleItemDone = async (itemId: string, doneStatus: boolean) => {
    const endpoint = doneStatus ? `${listApi}/done` : `${listApi}/undone`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemID: itemId })
      });
      if (response.ok) {
        showSnack(`הפריט סומן כ${doneStatus ? 'בוצע' : 'לא בוצע'}.`);
        await load();
      } else {
        const result = await response.json();
        throw new Error(result.error || response.statusText);
      }
    } catch (error: any) {
      showSnack(`שגיאה בשינוי סטטוס: ${error.message}`);
    }
  };

  // API call to delete an item
  const deleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`${listApi}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemID: itemId })
      });
      if (response.ok) {
        showSnack('הפריט הוסר מהרשימה.');
        await load();
      } else {
        const result = await response.json();
        throw new Error(result.error || response.statusText);
      }
    } catch (error: any) {
      showSnack(`שגיאה בהסרת פריט: ${error.message}`);
    }
  };

  // API call to update an item's quantity
  const updateItemQuantity = async (itemId: string, quantity: number) => {
    try {
      const response = await fetch(`${listApi}/quantity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemID: itemId, quantity })
      });
      if (response.ok) {
        showSnack(`כמות הפריט עודכנה.`);
        await load();
      } else {
        const result = await response.json();
        throw new Error(result.error || response.statusText);
      }
    } catch (error: any) {
      showSnack(`שגיאה בעדכון כמות: ${error.message}`);
    }
  };

  // Memoized calculation to group items by category
  const categorizedItems = useMemo(() => {
    const grouped = items.reduce((acc, item) => {
      const category = item.category || 'כללי';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, ListItem[]>);

    return Object.keys(grouped)
      .map(category => ({ title: category, data: grouped[category] }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  // Handler to toggle category visibility
  const toggleCategory = (categoryTitle: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryTitle)) {
        newSet.delete(categoryTitle);
      } else {
        newSet.add(categoryTitle);
      }
      return newSet;
    });
  };

  const ListHeader = ({ totalItems }: { totalItems: number }) => (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>רשימת קניות</Text>
        <LottieView
          source={require('../../assets/cart-navbar-animation.json')}
          autoPlay
          loop
          style={{ width: 32, height: 32 }}
        />
      </View>
      {totalItems > 0 && (
        <Text style={styles.totalItemsText}>
          סה"כ {totalItems} פריטים ברשימה
        </Text>
      )}
    </View>
  );

  // --- Render Logic ---

  // Show refresh animation at top when refreshing
  const [showRefreshLottie, setShowRefreshLottie] = useState(false);
  useEffect(() => {
    if (isRefreshing) {
      setShowRefreshLottie(true);
      const timeout = setTimeout(() => {
        setShowRefreshLottie(false);
        setRefreshing(false);
      }, 1600);
      return () => clearTimeout(timeout);
    }
  }, [isRefreshing]);

  if (isLoading || (isRefreshing && showRefreshLottie)) {
    return (
      <SafeAreaView style={styles.screen}>
        <ListHeader totalItems={0} />
        <View style={styles.center}>
          <LottieView
            source={require('../../assets/raise-animation.json')}
            autoPlay
            loop
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.loadingText}>טוען רשימת קניות…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <ListHeader totalItems={0} />
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

  if (items.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ListHeader totalItems={0} />
        <View style={styles.center}>
          <Ionicons name="cart-outline" size={40} color="#506c4fff" />
          <Text style={styles.emptyTitle}>רשימת הקניות שלך ריקה!</Text>
          <Text style={styles.emptySub}>פריטים שיתווספו יופיעו כאן.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ListHeader totalItems={items.length} />
      <SectionList
        contentContainerStyle={styles.listContent}
        sections={categorizedItems}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title, data } }) => (
          <Pressable onPress={() => toggleCategory(title)} style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <Ionicons name={collapsedCategories.has(title) ? "chevron-down-outline" : "chevron-up-outline"} size={24} color="#333" />
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <Text style={styles.sectionItemCount}>{data.length} פריטים</Text>
          </Pressable>
        )}
        renderItem={({ item, section, index }) => {
          const isVisible = !collapsedCategories.has(section.title);
          return (
            <AnimatedListItemRow
              key={item.id + '-' + isVisible}
              item={item}
              onToggleDone={toggleItemDone}
              onDelete={deleteItem}
              onUpdateQuantity={updateItemQuantity}
              index={index}
              visible={isVisible}
            />
          );
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="transparent" />
        }
      />
      {snack && (
        <View style={styles.snack}>
          <Text style={styles.snackText}>{snack}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------- Component: List Item Row ----------
function ListItemRow({ item, onToggleDone, onDelete, onUpdateQuantity }: { item: ListItem, onToggleDone: (itemId: string, doneStatus: boolean) => void, onDelete: (itemId: string) => void, onUpdateQuantity: (itemId: string, quantity: number) => void }) {
  return (
    <View style={[styles.listItemRow, item.done && styles.listItemDone]}>
      <Pressable onPress={() => onToggleDone(item.id, !item.done)} style={styles.checkboxContainer}>
        <Ionicons
          name={item.done ? "checkbox" : "square-outline"}
          size={24}
          color={item.done ? "#506c4fff" : "#999"}
        />
      </Pressable>
      <View style={styles.itemDetails}>
        <Text style={[styles.itemName, item.done && styles.itemDoneText]}>
          {item.name}
        </Text>
      </View>
      <View style={styles.actionsContainer}>
        <View style={styles.quantityContainer}>
          <Pressable onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}>
            <Ionicons name="add-circle-outline" size={24} color="#506c4fff" />
          </Pressable>
          <Text style={styles.itemQuantity}>{item.quantity}</Text>
          <Pressable onPress={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}>
            <Ionicons name="remove-circle-outline" size={24} color="#506c4fff" />
          </Pressable>
        </View>
        <Pressable onPress={() => onDelete(item.id)}>
          <Ionicons name="trash-outline" size={24} color="#B91C1C" />
        </Pressable>
      </View>
    </View>
  );
}

// ---------- Component: Animated List Item Row ----------
function AnimatedListItemRow({ item, onToggleDone, onDelete, onUpdateQuantity, index, visible }: { item: ListItem, onToggleDone: (itemId: string, doneStatus: boolean) => void, onDelete: (itemId: string) => void, onUpdateQuantity: (itemId: string, quantity: number) => void, index: number, visible: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          delay: index * 80,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 350,
          delay: index * 80,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start(() => setShouldRender(false));
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY }],
    }}>
      <ListItemRow
        item={item}
        onToggleDone={onToggleDone}
        onDelete={onDelete}
        onUpdateQuantity={onUpdateQuantity}
      />
    </Animated.View>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0ecd8ff" },
  header: { paddingHorizontal: 16, paddingTop: 65, paddingBottom: 24, backgroundColor: "#f0ecd8ff" },
  titleContainer: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', paddingRight: 16, gap: 8 },
  title: { fontSize: 32, fontWeight: "700", color: "#506c4fff", textAlign: 'right' },
  titleEmoji: { fontSize: 32 },
  totalItemsText: {
    fontSize: 16,
    color: "#666",
    textAlign: 'right',
    marginTop: 15,
    marginRight: 16,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 20 },
  loadingText: { fontSize: 18, color: "#506c4fff" },
  errorText: { color: "#B91C1C", fontSize: 18, textAlign: 'center' },
  retryBtn: { marginTop: 20, backgroundColor: "#506c4fff", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#506c4fff", textAlign: 'center' },
  emptySub: { fontSize: 15, color: "#666", textAlign: 'center' },
  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#506c4fff' },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#333", textAlign: 'right' },
  sectionItemCount: { fontSize: 16, color: "#666" },
  listItemRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#fffdefff', borderRadius: 5, marginVertical: 5, shadowColor: "#506c4fff", shadowOpacity: 0.05, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 0.5 },
  listItemDone: { backgroundColor: '#f0f0f0' },
  checkboxContainer: { padding: 4 },
  itemDetails: { flex: 1, alignItems: 'flex-end', marginHorizontal: 12 },
  itemName: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'right' },
  itemDoneText: { textDecorationLine: 'line-through', color: '#888' },
  actionsContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  quantityContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  itemQuantity: { fontSize: 18, fontWeight: '600', color: '#333', minWidth: 20, textAlign: 'center' },
  snack: { position: "absolute", bottom: 24, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, zIndex: 100 },
  snackText: { color: '#fff' },
});
