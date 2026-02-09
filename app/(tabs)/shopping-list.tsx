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
  TextInput,
  KeyboardAvoidingView,
  TouchableOpacity,
  Keyboard,
  PanResponder,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from '@/components/WebLottie';
import Modal from 'react-native-modal';


I18nManager.forceRTL(false);
I18nManager.allowRTL(false);


// ---------- Types ----------
type ListItem = {
  id: string;
  name: string;
  quantity: number;
  category: string;
  done: boolean;
};

// Type for the centralized message snackbar
type SnackMessage = {
  message: string;
  type: 'success' | 'error';
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
  const [snack, setSnack] = useState<SnackMessage | null>(null);
  const snackTimer = useRef<NodeJS.Timeout | null>(null);

  // UI state for list sections
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  // State for tracking which categories are currently deleting
  const [deletingCategories, setDeletingCategories] = useState<Set<string>>(new Set());

  // FAB/modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [addName, setAddName] = useState('');
  const [addQuantity, setAddQuantity] = useState('1');
  const [addCategory, setAddCategory] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [allSuggestions, setAllSuggestions] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const nameInputRef = useRef<TextInput>(null);
  
  // Overlay state for add animation
  const [showAddAnim, setShowAddAnim] = useState(false);

  // Fetch suggestions/categories from API when modal opens
  useEffect(() => {
    if (!modalVisible) return;
    // Only fetch if not already loaded
    if (allSuggestions.length > 0 && allCategories.length > 0) return;
    fetch(listApi)
      .then(res => res.json())
      .then(data => {
        // Suggestions
        if (Array.isArray(data.suggestions)) {
          setAllSuggestions(data.suggestions.filter((s: unknown) => s && typeof s === 'string'));
        } else {
          setAllSuggestions([]);
        }
        // Categories
        if (data.categories && typeof data.categories === 'object') {
          setAllCategories(Object.keys(data.categories));
        } else {
          setAllCategories([]);
        }
      })
      .catch(() => {
        setAllSuggestions([]);
        setAllCategories([]);
      });
  }, [modalVisible, allSuggestions.length, allCategories.length]);

  // Function to show a temporary snackbar message
  const showSnack = useCallback((msg: string, type: 'success' | 'error' = 'error') => {
    setSnack({ message: msg, type });
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 5200) as unknown as NodeJS.Timeout;
  }, []);

  // Function to fetch the shopping list from the API
  const load = useCallback(async (isInitialLoad = false) => {
    setError(null);
    try {
      const res = await fetch(listApi);
      if (!res.ok) throw new Error(`שגיאת שרת: ${res.status}`);
      const data = await res.json();

      const itemsArray = Object.values(data).filter(
        (item): item is ListItem => typeof item === 'object' && item !== null && 'id' in item
      );

      // --- CRITICAL FIX: Only collapse all categories on the very first initial load ---
      if (isInitialLoad) {
          const allCategories = new Set(itemsArray.map(item => item.category || 'כללי'));
          setCollapsedCategories(allCategories);
      }
      // ---------------------------------------------------------------------------------

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
    }, 1600); // Changed from 7000 to 1600 for better UX
  }, [load]);

  // Initial load effect
  useEffect(() => {
    load(true); // Pass true to collapse all on initial load
  }, [load]);

  // API call to toggle an item's 'done' status
  const toggleItemDone = useCallback(async (itemId: string, doneStatus: boolean) => {
    const endpoint = doneStatus ? `${listApi}/done` : `${listApi}/undone`;
    
    // 1. Optimistic update (for immediate UI response)
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? { ...item, done: doneStatus } : item
    ));

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemID: String(itemId) })
      });
      if (response.ok) {
        showSnack(`הפריט סומן כ${doneStatus ? 'בוצע' : 'לא בוצע'}`, 'success');
      } else {
        const result = await response.json();
        throw new Error(result.error || response.statusText);
      }
    } catch (error: any) {
      // 2. Rollback update and show error (only if API fails)
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { ...item, done: !doneStatus } : item
      ));
      showSnack(`שגיאה בשינוי סטטוס: ${error.message}`, 'error');
    }
  }, [showSnack]);

  // API call to delete an item
  const deleteItem = useCallback(async (itemId: string) => {
    
    // 1. Optimistic update
    const itemToDelete = items.find(i => i.id === itemId);
    const prevItems = items;
    setItems(prevItems.filter(item => item.id !== itemId));

    try {
      const response = await fetch(`${listApi}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemID: String(itemId) })
      });
      if (response.ok) {
      } else {
        const result = await response.json();
        throw new Error(result.error || response.statusText);
      }
    } catch (error: any) {
      // 2. Rollback and show error
      if(itemToDelete) setItems(prevItems => [...prevItems, itemToDelete]);
      showSnack(`שגיאה בהסרת פריט: ${error.message}`, 'error');
    }
  }, [items, showSnack]);

  // API call to update an item's quantity
  const updateItemQuantity = useCallback(async (itemId: string, quantity: number) => {
    
    // 1. Optimistic update
    const prevQuantity = items.find(i => i.id === itemId)?.quantity;
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? { ...item, quantity: quantity } : item
    ));

    try {
      const response = await fetch(`${listApi}/quantity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemID: String(itemId), quantity })
      });
      if (response.ok) {
        showSnack(`כמות הפריט עודכנה ל-${quantity}.`, 'success');
      } else {
        const result = await response.json();
        throw new Error(result.error || response.statusText);
      }
    } catch (error: any) {
      // 2. Rollback and show error
      if(prevQuantity !== undefined) setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { ...item, quantity: prevQuantity! } : item
      ));
      showSnack(`שגיאה בעדכון כמות: ${error.message}`, 'error');
    }
  }, [items, showSnack]);
  
  // Add item handler
    const handleAddItem = async (isAddMore: boolean) => {
    if (!addName.trim() || !addCategory.trim() || !addQuantity) return;
    if (!isAddMore){
      setAddLoading(true);
      setModalVisible(false);
      setShowAddAnim(true);
    }
    
    try {
      const res = await fetch(`${listApi}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: addName.trim(), quantity: Number(addQuantity), category: addCategory.trim(), method: 'manual' })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'שגיאה בהוספה');
      
      // Since item ID is assigned by server, we MUST reload the entire list 
      // to ensure the new item is present and sorted correctly.
      await load(); 
      
      setTimeout(() => {
        showSnack(`הפריט ${addName.trim()} נוסף בהצלחה.`, 'success');
        setShowAddAnim(false);
        setAddName('');
        setAddQuantity('1');
        setAddCategory('');
      }, 1500);

    } catch (e: any) {
      setTimeout(() => {
        setShowAddAnim(false);
        // Try to find the item by name (could be a false positive if duplicate check is complex)
        const found = items.find(i => i.name.trim() === addName.trim());
        if (found) {
          // If a duplicate item is found, open its category for visibility.
          toggleCategory(found.category || 'כללי');
        } else {
          // If no item found, re-open modal to allow correction
          setModalVisible(true);
        }
        setAddLoading(false);
        showSnack(e.message, 'error');
      }, 1500);
    } finally {
      setAddLoading(false);
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
      .map(category => {
        // Separate not-done and done items
        const notDone = grouped[category].filter(i => !i.done);
        const done = grouped[category].filter(i => i.done);
        return {
          title: category,
          // Sort not-done items by name, then append done items
          data: [...notDone.sort((a,b) => a.name.localeCompare(b.name)), ...done.sort((a,b) => a.name.localeCompare(b.name))],
          notDoneCount: notDone.length
        };
      })
      // Sort sections by title
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  // Handler to delete all items in a category
  const deleteAllInCategory = useCallback(async (categoryTitle: string) => {
    setDeletingCategories(prev => new Set(prev).add(categoryTitle));
    
    // 1. Optimistic UI update: Remove the whole category immediately
    const prevItems = items;
    setItems(prevItems.filter(item => (item.category || 'כללי') !== categoryTitle));

    const itemsInCategory = prevItems.filter(item => (item.category || 'כללי') === categoryTitle);
    
    try {
      for (const item of itemsInCategory) {
        // Use a simple, non-optimistic delete request inside the loop
        const response = await fetch(`${listApi}/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemID: String(item.id) })
        });
        if (!response.ok) {
           // On first failure, throw error to stop loop and rollback
           throw new Error(`Failed to delete item ${item.name}`);
        }
        // Small delay between deletions for better UX
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      showSnack(`הקטגוריה "${categoryTitle}" נמחקה בהצלחה.`, 'success');
    } catch (e) {
      // 2. Rollback UI on failure
      setItems(prevItems); // Restore previous list state
      showSnack(`שגיאה במחיקת קטגוריה: הקטגוריה לא נמחקה במלואה.`, 'error');
    } finally {
      setDeletingCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(categoryTitle);
        return newSet;
      });
    }

  }, [items, showSnack]);

  // Handler to toggle category visibility
  const toggleCategory = useCallback((categoryTitle: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryTitle)) {
        newSet.delete(categoryTitle);
      } else {
        newSet.add(categoryTitle);
      }
      return newSet;
    });
  }, []);

  // Toggle all categories open/closed
  const toggleAllCategories = useCallback(() => {
    setCollapsedCategories(prev => {
      let newSet: Set<string>;
      // if any collapsed -> open all (clear set)
      if (prev.size > 0) {
        newSet = new Set<string>();
      }
      // otherwise collapse all categories
      else {
        const all = new Set(categorizedItems.map(s => s.title));
        newSet = all;
      }
      return newSet;
    });
  }, [categorizedItems, showSnack]);

  const ListHeader = ({ totalItems, snack }: { totalItems: number, snack: SnackMessage | null }) => (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>רשימת קניות</Text>
        {!Platform.select({ web: true, default: false }) && (
          <LottieView
            source={require('../../assets/cart-navbar-animation.json')}
            loop
            style={{ width: 32, height: 32 }}
          />
        )}
      </View>
      {/* Toggle all button */}
      
      {totalItems > 0 && (
        <Text style={styles.totalItemsText}>
          סה"כ {totalItems} פריטים ברשימה
        </Text>
      )}
      <Pressable style={styles.toggleAllBtn} onPress={toggleAllCategories}>
        <Text style={styles.toggleAllText}>
          {collapsedCategories.size > 0 ? 'פתח הכל' : 'סגור הכל'}
        </Text>
      </Pressable>
      
      {/* NEW MESSAGE SNACKBAR LOCATION IN HEADER */}
      {snack && (
        <View style={[styles.headerMessage, snack.type === 'error' ? styles.snackErrorBg : styles.snackSuccessBg]}>
          <Text style={styles.snackText}>{snack.message}</Text>
        </View>
      )}
    </View>
  );

  // Suggestion logic for name
  useEffect(() => {
    if (!addName) setSuggestions([]);
    else setSuggestions(
      allSuggestions
        .filter(s => s && s.includes(addName) && s !== addName)
        .slice(0, 5)
    );
  }, [addName, allSuggestions]);

  // Suggestion logic for category
  useEffect(() => {
    if (!addCategory) setCategorySuggestions([]);
    else setCategorySuggestions(
      allCategories
        .filter(c => c && c.includes(addCategory))
        .slice(0, 5)
    );
  }, [addCategory, allCategories]);

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
        <ListHeader totalItems={0} snack={snack} />
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
        <ListHeader totalItems={0} snack={snack} />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(true)}> {/* Reload on error, collapse categories */}
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
        <ListHeader totalItems={0} snack={snack} />
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
      <ListHeader totalItems={items.length} snack={snack} />
        <SectionList
          contentContainerStyle={styles.listContent}
          sections={categorizedItems}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title, data, notDoneCount } }) => (
            <View>
              <Pressable onPress={() => toggleCategory(title)} style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={collapsedCategories.has(title) ? "chevron-down-outline" : "chevron-up-outline"} size={24} color="#333" />
                  <Text style={styles.sectionTitle}>{title}</Text>
                </View>
                <Text style={styles.sectionItemCount}>{notDoneCount} פריטים</Text>
              </Pressable>
              {/* Delete all button - only show when category is open */}
              {!collapsedCategories.has(title) && notDoneCount > 0 && (
                <Pressable 
                  style={styles.deleteAllBtn}
                  onPress={() => deleteAllInCategory(title)}
                  disabled={deletingCategories.has(title)}
                >
                  <Ionicons name="trash-outline" size={16} color="#000" />
                  <Text style={styles.deleteAllBtnText}>
                    {deletingCategories.has(title) ? 'מוחק...' : 'מחק הכל'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          renderItem={({ item, section, index }) => {
            const isVisible = !collapsedCategories.has(section.title);
            return (
              <AnimatedListItemRow
                // Key no longer needs to change based on visibility, 
                // as state changes won't trigger full reload.
                key={item.id} 
                item={item}
                onToggleDone={toggleItemDone}
                onDelete={deleteItem}
                onUpdateQuantity={updateItemQuantity}
                index={index}
                visible={isVisible} // Visibility is managed via state and prop
              />
            );
          }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="transparent" />
          }
        />
      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <LottieView source={require('../../assets/cart-add.json')} autoPlay={!Platform.select({ web: true, default: false })} loop={!Platform.select({ web: true, default: false })} style={Platform.select({ web: { width: 48, height: 48 }, default: { width: '100%', height: '100%' } })} />
      </TouchableOpacity>
      {/* Modal */} 
      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onSwipeComplete={() => setModalVisible(false)}
        swipeDirection="down"
        style={styles.modal}
        backdropOpacity={0.3}
        propagateSwipe
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Text style={styles.modalTitle}>מה בא לך היום?</Text>
            {!Platform.select({ web: true, default: false }) && (
              <LottieView source={require('../../assets/cart-add.json')} autoPlay loop style={{ width: '15%', height: '120%', marginLeft: 8, marginRight: 5, marginTop: 0, marginBottom: 22 }} />
            )}
          </View>
          {/* Message area inside modal (Now uses conditional styling based on snack type) */}
          {modalVisible && snack && (
            <View style={[styles.modalMessage, snack.type === 'error' ? styles.snackErrorBg : styles.snackSuccessBg]}>
              <Text style={styles.snackText}>{snack.message}</Text>
            </View>
          )}
                    <View style={{ zIndex: 10 }}>
            <TextInput
              ref={nameInputRef}
              style={styles.input}
              placeholder="שם פריט"
              value={addName}
              onChangeText={text => {
                setAddName(text);
                setShowNameSuggestions(true);
              }}
              autoFocus
              returnKeyType="next"
              onFocus={() => setShowNameSuggestions(true)}
              onBlur={() => setTimeout(() => setShowNameSuggestions(false), 120)}
            />
            {modalVisible && suggestions.length > 0 && showNameSuggestions && (
              <View style={[styles.suggestionList, styles.suggestionListEnhanced]}> 
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 140 }}>
                  {suggestions.map(s => (
                    <TouchableOpacity key={s} onPress={() => {
                      setAddName(s);
                      setShowNameSuggestions(false);
                    }} style={styles.suggestionItem}>
                      <Text style={styles.suggestionText} numberOfLines={1} ellipsizeMode="tail">{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
          <TextInput
            style={styles.input}
            placeholder="כמות"
            value={addQuantity}
            onChangeText={setAddQuantity}
            keyboardType="numeric"
            returnKeyType="next"
            onFocus={() => {
              if (addQuantity === '1') setAddQuantity('');
              setShowNameSuggestions(false);
              setShowCategorySuggestions(false);
            }}
            onBlur={() => {
              setShowNameSuggestions(false);
              setShowCategorySuggestions(false);
            }}
          />
          <View style={{ zIndex: 9 }}>
            <TextInput
              style={styles.input}
              placeholder="קטגוריה"
              value={addCategory}
              onChangeText={text => {
                setAddCategory(text);
                setShowCategorySuggestions(true);
              }}
              returnKeyType="done"
              onFocus={() => setShowCategorySuggestions(true)}
              onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 120)}
            />
            {modalVisible && categorySuggestions.length > 0 && showCategorySuggestions && (
              <View style={[styles.suggestionList, styles.suggestionListEnhanced]}> 
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 140 }}>
                  {categorySuggestions.map(c => (
                    <TouchableOpacity key={c} onPress={() => {
                      setAddCategory(c);
                      setShowCategorySuggestions(false);
                    }} style={styles.suggestionItem}>
                      <Text style={styles.suggestionText} numberOfLines={1} ellipsizeMode="tail">{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
                    <TouchableOpacity
            style={[styles.addButton, (!addName.trim() || !addCategory.trim() || !addQuantity) && { opacity: 0.5 }]}
            onPress={() => handleAddItem(false)}
            disabled={!addName.trim() || !addCategory.trim() || !addQuantity || addLoading}
          >
            <Text style={styles.addButtonText}>תעמיס לי !</Text>
          </TouchableOpacity>
          
                   <Pressable
            style={styles.addAnotherBtn}
            onPress={() => {
              handleAddItem(true);
              setAddName('');
              setAddQuantity('1');
              setAddCategory('');
              setShowNameSuggestions(false);
              setShowCategorySuggestions(false);
              setTimeout(() => {
                nameInputRef.current?.focus();
              }, 100);
            }}
          >
            <Text style={styles.addAnotherBtnText}>הוסף עוד אחד</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      {/* Add animation overlay above modal */}
      {showAddAnim && !Platform.select({ web: true, default: false }) && (
        <View style={styles.addAnimOverlayNoBg} pointerEvents="none">
          <LottieView source={require('../../assets/refresh-animation.json')} autoPlay loop style={Platform.select({ web: { width: 140, height: 140 }, default: { width: 450, height: 450 } })} />
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------- Component: List Item Row ----------
function ListItemRow({ item, onToggleDone, onDelete, onUpdateQuantity }: { item: ListItem, onToggleDone: (itemId: string, doneStatus: boolean) => void, onDelete: (itemId: string) => void, onUpdateQuantity: (itemId: string, quantity: number) => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [dismissed, setDismissed] = useState(false);

  // Always use #506c4fff for swipe background (both directions)
  const bgColor = translateX.interpolate({
    inputRange: [-500, -120, 0, 120, 500],
    outputRange: ['#506c4fff', '#506c4fff', '#fffdefff', '#506c4fff', '#506c4fff'],
    extrapolate: 'clamp',
  });

  // Opacity and position for delete text (show for both left and right swipe, reveal earlier)
  const deleteTextOpacity = translateX.interpolate({
    inputRange: [-50, -20, 0, 20, 50],
    outputRange: [1, 0, 0, 0, 1],
    extrapolate: 'clamp',
  });
  const deleteTextTranslate = translateX.interpolate({
    inputRange: [-50, 0, 50],
    outputRange: [0, 32, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        // Allow both left and right swipe
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -120) {
          // Swiped left for delete
          Animated.timing(translateX, {
            toValue: -500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            // Note: Optimistic update handles the immediate removal in ShoppingListPage.
            // We just need to trigger the delete action.
            onDelete(item.id);
          });
        } else if (gestureState.dx > 120) {
          // Optionally keep right swipe for future actions, or just snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // The item is visually removed from the list when the parent state updates 
  // (via optimistic delete in ShoppingListPage), so no local 'dismissed' state is strictly needed 
  // unless we want a specific local animation before parent re-renders.
  // For now, let's rely on the parent's items state change.

  return (
    <View style={{ position: 'relative', justifyContent: 'center', alignItems: 'stretch' }}>
      {/* Delete text overlays behind the card, centered vertically */}
      {/* Left side (swipe left) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 18,
          top: '50%',
          transform: [
            { translateY: -14 }, // half the height of icon+text (approx)
            { translateX: deleteTextTranslate }
          ],
          flexDirection: 'row',
          opacity: deleteTextOpacity,
          zIndex: 1,
        }}
      >
        <Ionicons name="trash-outline" size={22} color="#506c4fff" style={{ marginRight: 6 }} />
        <Text style={{ color: '#506c4fff', fontWeight: 'bold', fontSize: 16 }}>מחק פריט</Text>
      </Animated.View>
      {/* Right side (swipe right) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 18,
          top: '50%',
          transform: [
            { translateY: -14 },
            { translateX: Animated.multiply(deleteTextTranslate, -1) }
          ],
          flexDirection: 'row-reverse',
          opacity: deleteTextOpacity,
          zIndex: 1,
        }}
      >
        <Ionicons name="trash-outline" size={22} color="#506c4fff" style={{ marginLeft: 6 }} />
        <Text style={{ color: '#506c4fff', fontWeight: 'bold', fontSize: 16 }}>מחק פריט</Text>
      </Animated.View>
      {/* Foreground card */}
            <Animated.View
        style={[
          styles.listItemRow,
          item.done && styles.listItemDone,
          { transform: [{ translateX }], backgroundColor: bgColor, zIndex: 2 },
        ]}
        {...panResponder.panHandlers}
        pointerEvents={item.done ? 'auto' : 'auto'}
      >
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
        <View style={item.done ? styles.actionsContainerDisabled : styles.actionsContainer}>
          <View style={styles.quantityContainer}>
            <Pressable onPress={() => onUpdateQuantity(item.id, item.quantity + 1)} disabled={item.done}>
              <Ionicons name="add-circle-outline" size={24} color={item.done ? '#ccc' : '#506c4fff'} />
            </Pressable>
            <Text style={[styles.itemQuantity, item.done && styles.itemDoneText]}>{item.quantity}</Text>
            <Pressable onPress={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))} disabled={item.done}>
              <Ionicons name="remove-circle-outline" size={24} color={item.done ? '#ccc' : '#506c4fff'} />
            </Pressable>
          </View>
          <Pressable onPress={() => onDelete(item.id)} disabled={item.done}>
            <Ionicons name="trash-outline" size={24} color={item.done ? '#eee' : '#B91C1C'} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------- Component: Animated List Item Row ----------
function AnimatedListItemRow({ item, onToggleDone, onDelete, onUpdateQuantity, index, visible }: { item: ListItem, onToggleDone: (itemId: string, doneStatus: boolean) => void, onDelete: (itemId: string) => void, onUpdateQuantity: (itemId: string, quantity: number) => void, index: number, visible: boolean }) {
  // Use a simple local state to control the mounting/unmounting based on visibility
  // The 'items' array update will not cause the list to unmount/remount now, 
  // so we can rely on the 'visible' prop being set by the SectionList logic.
  
  if (!visible) return null;

  return (
    <ListItemRow
      item={item}
      onToggleDone={onToggleDone}
      onDelete={onDelete}
      onUpdateQuantity={onUpdateQuantity}
    />
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
  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, marginBottom: 5, borderBottomColor: '#506c4fff' },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#333", textAlign: 'right' },
  sectionItemCount: { fontSize: 16, color: "#666" },
  listItemRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fffdefff', borderRadius: 5, marginVertical: 5,marginHorizontal: 8,marginTop: 5 ,shadowColor: "#506c4fff", shadowOpacity: 0.05, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 0.5 },
  listItemDone: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  checkboxContainer: { padding: 4 },
  itemDetails: { flex: 1, alignItems: 'flex-end', marginHorizontal: 12 },
  itemName: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'right' },
  itemDoneText: {
    textDecorationLine: 'line-through',
    color: '#888',
    textAlign: 'right',
  },
  actionsContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  actionsContainerDisabled: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    opacity: 0.5,
  },
  quantityContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  itemQuantity: { fontSize: 18, fontWeight: '600', color: '#333', minWidth: 20, textAlign: 'center' },
  snackText: { color: '#fff' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    backgroundColor: '#f7f5e0ff',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    zIndex: 10,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fffdefff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: 340,
    alignItems: 'stretch',
  },
  modalHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#506c4fff',
    textAlign: 'center',
    marginBottom: 18,
  },
  input: {
    backgroundColor: '#fffdefff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f0e0eff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'right',
    marginBottom: 10,
  },
  suggestionList: {
    backgroundColor: '#506c4fff',
    borderRadius: 10,
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#506c4fff',
    shadowColor: '#506c4fff',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    maxHeight: 120,
    minWidth: 120,
    maxWidth: '98%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  suggestionListEnhanced: {
    position: 'absolute',
    top: 52,
    left: '1%',
    borderRadius: 10,
    right: '1%',
    zIndex: 100,
    maxWidth: '98%',
    alignSelf: 'center',
  },
  suggestionItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#506c4fff',
    backgroundColor: '#fffdefff',
  },
  suggestionText: {
    fontSize: 16,
    color: '#506c4fff',
    textAlign: 'right',
    fontWeight: '600',
    maxWidth: '98%',
  },
  addButton: {
    backgroundColor: '#506c4fff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  addAnimOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(240,236,216,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  addAnimOverlayNoBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  // Base style for message snackbars in the modal
  modalMessage: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  // Base style for message snackbars in the header
  headerMessage: {
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  // Color specific styles
  snackErrorBg: {
    backgroundColor: 'rgba(238, 83, 63, 0.95)', // Red/Error
  },
  snackSuccessBg: {
    backgroundColor: '#506c4fff', // Green/Success
  },
  toggleAllBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#506c4fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 14,
  },
  toggleAllText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  // State for tracking which categories are currently deleting
  deletingCategories: {
    alignSelf: 'flex-end',
    backgroundColor: '#B91C1C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  deleteAllBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  
  deleteAllBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#f0ecd8fff0ecd8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginTop: 2,
    marginBottom: 2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
      addAnotherBtn: {
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: '#fffdefff',
      alignItems: 'center',
      marginBottom: 0,
    },
    addAnotherBtnText: {
      color: '#506c4fff',
      fontWeight: '600',
      fontSize: 13,
    },

});

