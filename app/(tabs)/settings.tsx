import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
  Pressable,
  Linking,
  KeyboardAvoidingView,
  RefreshControl
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from "@expo/vector-icons";
import LottieView from '@/components/WebLottie';

// Types
type Store = {
  StoreId: string;
  StoreName: string;
  City: string;
  Address: string;
  brandName: string;
  ZipCode?: string;
  BikoretNo?: number;
};

type SupermarketSettings = {
  supermarkets: {
    liked: { [key: string]: Store[] };
    available: { [key: string]: Store[] };
  };
};

// Hebrew brand names mapping
const hebrewBrandNames: { [key: string]: string } = {
  'osherad': 'אושר עד',
  'yohananof': 'יוחננוף'
};

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshLottie, setShowRefreshLottie] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedStores, setLikedStores] = useState<Store[]>([]);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [showSuccessSplash, setShowSuccessSplash] = useState(false);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const showSnack = useCallback((message: string) => {
    setSnackMessage(message);
    setTimeout(() => setSnackMessage(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('https://zenlist.hack-ops.net/api/generalSettings');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: SupermarketSettings = await response.json();

      // Transform data structure
      const liked = Object.entries(data.supermarkets.liked).flatMap(([brand, stores]) =>
        stores.map(store => ({ ...store, brandName: brand }))
      );
      const available = Object.entries(data.supermarkets.available).flatMap(([brand, stores]) =>
        stores.map(store => ({ ...store, brandName: brand }))
      );

      setLikedStores(liked);
      setAvailableStores(available);
    } catch (e: any) {
      setError("שגיאה בטעינת ההגדרות. נסה שוב.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setShowRefreshLottie(true);
    await load();
    setTimeout(() => {
      setShowRefreshLottie(false);
      setIsRefreshing(false);
    }, 2500);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const updateLikedSupermarket = async (storeId: string, brandName: string, action: 'add' | 'remove') => {
    setShowRefreshLottie(true);
    try {
      const response = await fetch(`https://zenlist.hack-ops.net/api/generalSettings/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ StoreId: storeId, brandName })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await load();
      showSnack('ההגדרות עודכנו בהצלחה');
      setShowSuccessSplash(true);
      setTimeout(() => setShowSuccessSplash(false), 2000);
    } catch (error) {
      showSnack('שגיאה בעדכון ההגדרות');
      if (action === 'add') {
        setTimeout(() => {
          setModalVisible(true);
          setPermissionError('שגיאה בהוספת החנות');
        }, 500);
      }
    } finally {
      setShowRefreshLottie(false);
    }
  };

  const updatePrices = async () => {
    setShowRefreshLottie(true);
    try {
      const response = await fetch('https://zenlist.hack-ops.net/api/generalsettings/updatePrices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "manualUpdate" })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      showSnack('עדכון מחירים בוצע בהצלחה!');
      setShowSuccessSplash(true);
      setTimeout(() => setShowSuccessSplash(false), 2000);
    } catch (error) {
      showSnack('שגיאה בעדכון מחירים');
    } finally {
      setShowRefreshLottie(false);
    }
  };

  const filteredStores = searchText
    ? availableStores.filter(store => {
        const brandName = store.brandName || '';
        const brandNameHebrew = hebrewBrandNames[brandName] || '';
        const fields = [
          store.StoreName,
          store.City,
          store.Address,
          store.ZipCode,
          store.BikoretNo?.toString(),
          brandName,
          brandNameHebrew
        ].filter((field): field is string => typeof field === 'string' && !!field);
        const haystack = fields.join(' ').toLowerCase();
        return (
          !likedStores.some(liked => liked.StoreId === store.StoreId) &&
          searchText
            .toLowerCase()
            .split(' ')
            .filter(Boolean)
            .every(word => haystack.includes(word))
        );
      })
    : [];

  const openInMaps = (store: Store) => {
    const query = `${store.Address} ${store.City}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  };

  if (isLoading || (isRefreshing && showRefreshLottie)) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>הגדרות</Text>
        </View>
        <View style={styles.center}>
          <LottieView
            source={require('../../assets/raise-animation.json')}
            autoPlay
            speed={1.3}
            loop={true}
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.loadingText}>טוען הגדרות...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={["#506c4fff"]}
            style={{ backgroundColor: 'transparent' }}
            progressViewOffset={-30}
            progressBackgroundColor="transparent"
            // Custom Lottie animation overlay
            // We'll overlay the LottieView below
          />
        }
      >
        
        <View style={styles.header}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            <Text style={styles.title}>הגדרות</Text>
            <LottieView
              source={require('../../assets/settings.json')}
              autoPlay
              loop
              style={{ width: 42, height: 42, marginRight: 8 }}
            />
          </View>
        </View>

        {/* Liked Stores Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>חנויות מועדפות</Text>
          {likedStores.map((store) => (
            <View key={store.StoreId} style={styles.storeCard}>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>
                  {hebrewBrandNames[store.brandName] || store.brandName}
                </Text>
                <Text style={styles.storeAddress}>
                  {store.StoreName}, {store.City}
                </Text>
                <Text style={styles.storeDetails}>
                  {store.Address !== 'unknown' ? store.Address : 'כתובת לא ידועה'}
                </Text>
              </View>
              <View style={styles.storeActions}>
                <TouchableOpacity
                  onPress={() => updateLikedSupermarket(store.StoreId, store.brandName, 'remove')}
                  style={styles.removeButton}
                >
                  <Ionicons name="trash-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
                {store.Address !== 'unknown' && (
                  <TouchableOpacity
                    onPress={() => openInMaps(store)}
                    style={styles.mapButton}
                  >
                    <Ionicons name="location-outline" size={24} color="#3b82f6" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Update Prices Button */}
        <TouchableOpacity style={styles.updateButton} onPress={updatePrices}>
          <Text style={styles.updateButtonText}>עדכן מחירים</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* FAB for adding stores */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setModalVisible(true);
          setSearchText('');
          setPermissionError(null);
        }}
        activeOpacity={0.8}
      >
        <LottieView
          source={require('../../assets/settings.json')}
          autoPlay
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </TouchableOpacity>


      {/* Search Modal - shopping-list style */}
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
            <Text style={styles.modalTitle}>אחרי מי לעקוב ?</Text>
            <LottieView source={require('../../assets/cart-add.json')} autoPlay loop style={Platform.OS === 'web' ? { width: 48, height: 48, marginLeft: 8, marginRight: 5, marginTop: 0, marginBottom: 20 } : { width: 48, height: 48, marginLeft: 8, marginRight: 5, marginTop: 0, marginBottom: 20 }} />
          </View>
          {permissionError ? (
            <View style={styles.modalMessage}><Text style={styles.snackbarText}>{permissionError}</Text></View>
          ) : null}
          <TextInput
            style={styles.searchInput}
            placeholder="חפש חנות לפי שם, עיר או כתובת..."
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
            returnKeyType="search"
          />
          <ScrollView style={styles.searchResultsContainer}>
            {filteredStores.length === 0 ? (
              <Text style={styles.noResults}>לא נמצאו חנויות</Text>
            ) : (
              filteredStores.map((store) => (
                <TouchableOpacity
                  key={store.StoreId}
                  style={styles.searchResultItem}
                  onPress={async () => {
                    setModalVisible(false);
                    setShowRefreshLottie(true);
                    await updateLikedSupermarket(store.StoreId, store.brandName, 'add');
                  }}
                >
                  <Text style={styles.searchResultTitle}>
                    {hebrewBrandNames[store.brandName] || store.brandName}
                  </Text>
                  <Text style={styles.searchResultSubtitle}>
                    {store.StoreName}, {store.City}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeModalBtn}
            onPress={() => {
              setModalVisible(false);
              setSearchText('');
            }}
          >
            <Text style={styles.closeModalBtnText}>סגור</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>


      {/* Loading Animation (overlay for pull-to-refresh and actions) */}
      {showRefreshLottie && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]} pointerEvents="none">
          <LottieView
            source={require('../../assets/raise-animation.json')}
            autoPlay
            speed={1.3}
            loop={true}
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.loadingText}>מעבד...</Text>
        </View>
      )}

   

      {/* Snackbar */}
      {snackMessage && (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>{snackMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0ecd8ff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginTop: Platform.OS === 'android' ? 50 : 0,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    color: "#506c4fff",
    textAlign: 'right',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#506c4fff",
    marginBottom: 16,
    textAlign: 'right',
  },
  storeCard: {
    backgroundColor: "#fffdefff",
    borderRadius: 5,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: "#545353ff",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 0.5,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#506c4fff',
    textAlign: 'right',
  },
  storeAddress: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
  },
  storeDetails: {
    fontSize: 14,
    color: '#888',
    textAlign: 'right',
  },
  storeActions: {
    flexDirection: 'row-reverse',
    gap: 12,
    position: 'absolute',
    left: 16,
  },
  removeButton: {
    padding: 8,
  },
  mapButton: {
    padding: 8,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#506c4fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  searchResultsContainer: {
    maxHeight: 300,
    marginVertical: 10,
  },
  permissionError: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 10,
  },
  closeModalBtn: {
    backgroundColor: '#506c4fff',
    borderRadius: 5,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  closeModalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#506c4fff',
    textAlign: 'right',
  },
  searchResultSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  searchInput: {
    backgroundColor: "#fffdefff",
    borderRadius: 5,
    padding: 16,
    fontSize: 16,
    textAlign: 'right',
    shadowColor: "#545353ff",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 0.5,
    marginBottom: 8,
  },
  noResults: {
    padding: 16,
    textAlign: 'center',
    color: '#666',
  },
  updateButton: {
    backgroundColor: '#506c4fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 0,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingOverlay: {
    backgroundColor: '#f0ecd8ff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  successOverlay: {
    backgroundColor: '#f0ecd8ff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#506c4fff',
    marginTop: 16,
  },
  snackbar: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  snackbarText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  // Modal styles for shopping-list style
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
  modalMessage: {
    backgroundColor: 'rgba(238, 83, 63, 0.95)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
});
