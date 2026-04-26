import { useAppStateFlow } from '@/hooks/useAppStateFlow';
import { useLocationDetection } from '@/hooks/useLocationDetection';
import { fetchUserFavorites, toggleUserFavorite } from '@/lib/auth_api';
import { getDistanceKm } from '@/lib/google_location';
import { useMenuStore, refreshMenuStore, formatPeso, resolveProductImage, type Food } from '@/lib/menu_store';
import {
  formatAddressForDisplay,
  setFavorites,
  toggleFavorite,
  useUiStore
} from '@/lib/ui_store';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { useBranch } from '@/state/contexts/BranchContext';
import { useCart } from '@/state/contexts/CartContext';
import { useLocation } from '@/state/contexts/LocationContext';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RiderStatusPanel } from '@/components/RiderStatusPanel';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Animated as RNAnimated,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Components
import BottomNav, { type NavTab } from '../components/BottomNav';
import CartPanel from '../components/CartPanel';
import CategoryIcon from '../components/CategoryIcon';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';
import FavoritesPanel from '../components/FavoritesPanel';
import FoodCard from '../components/FoodCard';
import FoodDetailModal from '../components/FoodDetailModal';
import ProfilePanel from '../components/ProfilePanel';
import StoresPanel from '../components/StoresPanel';

type FilterMode = 'default' | 'low_price' | 'high_calorie' | 'favorites';
type PriceRange = 'all' | 'under_8' | '8_to_10' | 'above_10';

const NAV_HEIGHT = 60;
const BOTTOM_NAV_WIDTH = 300;
const TAB_BUTTON_SIZE = 40;

const getPriceValue = (price: string): number =>
  Number(price.replace('\u20B1', '').replace(',', '').trim());
const getCaloriesValue = (calories: string): number => Number(calories.replace(' kcal', ''));

export default function HomeDashboard() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { categories: categoryData, menuItems: products, isRefreshing } = useMenuStore();
  const { state: locationState } = useLocation();
  const { state: branchState } = useBranch();
  const { state: cartState, dispatch: cartDispatch } = useCart();
  const { setAddress } = useAppStateFlow();

  const { userId, sessionStatus, favorites, addresses, activeAddressId, orderMode } = useUiStore();
  const { selectedAddress, isLocationLoading, isServiceable } = locationState;
  const { selectedBranch, isManualSelection, catalogMode } = branchState;
  const { items: cartItems } = cartState;
  const isGlobalMode = catalogMode === 'global';

  const { detectLocation, isLoadingGPS } = useLocationDetection();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const favoritesCount = favorites.length;

  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<NavTab>((params.tab as NavTab) ?? 'home');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [notificationCount] = useState<number>(3);
  const [filterMode, setFilterMode] = useState<FilterMode>('default');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? (NativeStatusBar.currentHeight ?? 0) : insets.top;
  const navBottomOffset = Math.max(insets.bottom, 12) + 20;
  const contentBottomPadding = NAV_HEIGHT + navBottomOffset + 40;

  // Fly-to-cart animation logic
  const flyX = useSharedValue(0);
  const flyY = useSharedValue(0);
  const flyScale = useSharedValue(0);
  const flyOpacity = useSharedValue(0);

  const triggerFlyAnimation = useCallback(() => {
    const { width: W_WIDTH, height: W_HEIGHT } = Dimensions.get('window');
    flyX.value = W_WIDTH / 2;
    flyY.value = W_HEIGHT / 2;
    flyScale.value = 0.5;
    flyOpacity.value = 1;

    const targetX = W_WIDTH - 45;
    const targetY = topInset + 40;

    flyX.value = withTiming(targetX, { duration: 600, easing: Easing.inOut(Easing.quad) });
    flyY.value = withTiming(targetY, { duration: 600, easing: Easing.inOut(Easing.quad) });
    flyScale.value = withTiming(1.2, { duration: 300 }, (finished) => {
      if (finished) flyScale.value = withTiming(0, { duration: 300 });
    });
    flyOpacity.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.exp) });
  }, [flyOpacity, flyScale, flyX, flyY, topInset]);

  const flyStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF5800',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    opacity: flyOpacity.value,
    transform: [
      { translateX: flyX.value - 15 },
      { translateY: flyY.value - 15 },
      { scale: flyScale.value }
    ],
  }));
  
  // 🔐 AUTH GUARD
  useEffect(() => {
    if (sessionStatus === 'unauthorized' || (sessionStatus === 'expired' && !userId)) {
      router.replace('/login');
    }
  }, [sessionStatus, userId]);

  // 🧠 REAL-TIME ADDRESS SYNC (The Engine Trigger)
  useEffect(() => {
    let isMounted = true;
    const syncAddress = async () => {
      if (activeAddressId) {
        const addr = addresses.find(a => a.id === activeAddressId);
        const hasChanged = addr && (
          addr.latitude !== selectedAddress?.latitude ||
          addr.longitude !== selectedAddress?.longitude ||
          addr.id !== selectedAddress?.id
        );

        if (hasChanged && isMounted) {
          await setAddress(addr!);
        }
      }
    };
    syncAddress();
    return () => { isMounted = false; };
  }, [activeAddressId, addresses, setAddress, selectedAddress]);

  const activeAddress = useMemo(() =>
    addresses.find(a => a.id === activeAddressId),
    [addresses, activeAddressId]
  );


  // Fetch favorites if logged in
  useEffect(() => {
    let isMounted = true;
    if (userId) {
      fetchUserFavorites(userId)
        .then((fetchedFavs) => {
          if (isMounted) setFavorites(fetchedFavs);
        })
        .catch((e) => console.log('Failed to hydrate favorites:', e));
    }
    return () => { isMounted = false; };
  }, [userId]);

  // Sync activeTab with route params
  useEffect(() => {
    if (params.tab) {
      setActiveTab(params.tab as NavTab);
    }
  }, [params.tab]);

  // Keyboard handling
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const subHide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // Sync activeTab with URL params
  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab as NavTab);
    }
  }, [params.tab]);

  // Validate cart when products/branch changes
  useEffect(() => {
    if (activeAddressId && products.length > 0 && cartItems.length > 0) {
      cartDispatch({ type: 'VALIDATE_CART', payload: products });
    }
  }, [products, activeAddressId]);



  const cardWidth = useMemo(() => {
    const horizontalPadding = 40;
    const totalGap = 32; // Increased from 24
    const available = width - horizontalPadding - totalGap;
    return Math.max(140, available / 2 - 4);
  }, [width]);

  // 🎯 API-DRIVEN REFRESH Rule
  const handleRefresh = useCallback(async (catId?: string | number | object) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const mode = isGlobalMode ? 'global' : 'branch';
    const bId = selectedBranch?.id;
    // If catId is an event (from Pull to Refresh) or not provided, use activeCategory
    const targetCatId = (typeof catId === 'object' || catId === undefined) ? activeCategory : catId;
    await refreshMenuStore(mode, bId, targetCatId === 'all' ? undefined : (targetCatId as string | number));
  }, [isGlobalMode, selectedBranch, activeCategory]);

  // Refresh when location/branch or category changes
  useEffect(() => {
    handleRefresh(activeCategory);
  }, [activeCategory, isGlobalMode, selectedBranch]);

  const handleToggleFavorite = useCallback((foodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(foodId);
    if (userId) {
      toggleUserFavorite(userId, foodId).catch((e) => console.log('Sync favorite failed:', e));
    }
  }, [userId]);

  const handleAddToCart = useCallback((item: Food, quantity: number = 1) => {
    // Block cart in Global Catalog Mode
    if (isGlobalMode) {
      Alert.alert(
        "Browse Only Mode",
        "You're viewing the full menu catalog. Select a delivery address within a branch's delivery area to start ordering.",
        [
          { text: "OK", style: "cancel" },
          { text: "Set Address", onPress: () => setShowDeliveryModal(true) }
        ]
      );
      return;
    }

    if (!activeAddress) {
      Alert.alert("Address Required", "Please select a delivery address to check availability and start ordering.", [
        { text: "Cancel", style: "cancel" },
        { text: "Select Address", onPress: () => setShowDeliveryModal(true) }
      ]);
      return;
    }

    if (!selectedBranch) {
      Alert.alert("No Branch Selected", "Please select a delivery address within a branch's delivery area.");
      return;
    }

    const rawStock = item.max_quantity ?? item.stock;
    const hasStockLimit = rawStock != null && Number(rawStock) > 0;
    const maxQuantity = hasStockLimit ? Math.floor(Number(rawStock)) : Infinity;
    const existingQty = cartItems.find((i) => i.id === item.id)?.quantity ?? 0;

    if (hasStockLimit && existingQty + quantity > maxQuantity) {
      Alert.alert('Stock Limit', `Only ${maxQuantity} servings available. You already have ${existingQty} in your cart.`);
      return;
    }

    cartDispatch({
      type: 'ADD_ITEM',
      payload: {
        branchId: selectedBranch.id,
        item: {
          id: item.id,
          title: item.name,
          price: formatPeso(item.selling_price),
          quantity: quantity,
          image: resolveProductImage(item.image_path),
          description: item.description,
          checked: true
        }
      }
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    triggerFlyAnimation();
  }, [cartItems, triggerFlyAnimation, isGlobalMode, selectedBranch, activeAddress]);

  const handleFoodPress = useCallback((item: Food) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood(item);
    setShowDetailModal(true);
  }, []);

  const handleCheckout = useCallback(() => {
    const checkedCartItems = cartItems.filter((i) => i.checked);
    const checkoutData = checkedCartItems.map(cartItem => ({
      id: cartItem.id,
      quantity: cartItem.quantity
    }));

    setShowDetailModal(false);
    setTimeout(() => {
      router.push({
        pathname: '/checkout',
        params: { cart: JSON.stringify(checkoutData) }
      } as any);
    }, 300);
  }, [cartItems, router]);

  const handleTabPress = useCallback((tab: NavTab) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, [activeTab]);


  const distanceToBranch = useMemo(() => {
    if (!selectedBranch || !activeAddress?.latitude || !activeAddress?.longitude || !selectedBranch.latitude || !selectedBranch.longitude) return null;
    return getDistanceKm(
      activeAddress.latitude,
      activeAddress.longitude,
      selectedBranch.latitude,
      selectedBranch.longitude
    );
  }, [selectedBranch, activeAddress]);

  const isOutsideRadius = useMemo(() => {
    if (distanceToBranch === null || !selectedBranch?.delivery_radius_km) return false;
    return distanceToBranch > selectedBranch.delivery_radius_km;
  }, [distanceToBranch, selectedBranch]);

  const filteredFoods = useMemo(() => {
    let list = products;

    // ⚡ Backend handles category filtering. We only handle local search/sort/price filters here.
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(s) || f.category_name.toLowerCase().includes(s));
    }
    if (priceRange !== 'all') {
      list = list.filter(f => {
        const v = f.selling_price;
        if (priceRange === 'under_8') return v < 450;
        if (priceRange === '8_to_10') return v >= 450 && v <= 550;
        return v > 550;
      });
    }
    if (filterMode === 'low_price') {
      list = [...list].sort((a, b) => a.selling_price - b.selling_price);
    } else if (filterMode === 'high_calorie') {
      list = [...list]; // Calories removed from DB schema
    } else if (filterMode === 'favorites') {
      list = list.filter(f => favorites.includes(f.id));
    }
    return list;
  }, [activeCategory, favorites, filterMode, products, priceRange, search]);

  const favoriteFoods = useMemo(
    () => products.filter((item) => favorites.includes(item.id)),
    [favorites, products]
  );

  const isOpen = selectedBranch?.status ? selectedBranch.status.toLowerCase() === 'open' : true;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.surface} />

      {/* 🛡️ SYSTEM MESSAGING BLOCK (Mutually Exclusive to prevent glitching) */}
      {(() => {
        if (isLocationLoading) return null;

        // 1. Global Mode (No branch nearby)
        if (isGlobalMode) {
          return (
            <View style={[styles.globalModeBanner, { backgroundColor: colors.surface }]}>
              <Ionicons name="globe-outline" size={18} color={colors.primary} />
              <Text style={[styles.globalModeBannerText, { color: colors.text }]}>
                No available delivery branch in this location.
              </Text>
            </View>
          );
        }

        // 2. No Address Selected
        if (!activeAddress) {
          return (
            <View style={[styles.softMenuBanner, { backgroundColor: colors.surface }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.softMenuText, { color: colors.text }]}>
                Select a delivery address to continue and check availability.
              </Text>
            </View>
          );
        }

        // 3. Out-of-Service Area (Laguna Only)
        if (!isServiceable) {
          return (
            <View style={[styles.softMenuBanner, { backgroundColor: '#FF5252' }]}>
              <Ionicons name="location-outline" size={18} color="#FFF" />
              <Text style={styles.softMenuText}>
                We currently deliver within Laguna only.
              </Text>
            </View>
          );
        }



        // 5. Active Branch Mode (Smart Message)
        if (selectedBranch) {
          return (
            <View style={[styles.smartMessageBanner, { backgroundColor: colors.surface, borderBottomColor: colors.primary + '33' }]}>
              <Ionicons
                name={isManualSelection ? "information-circle-outline" : "sparkles-outline"}
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.smartMessageText, { color: colors.heading }]}>
                {isManualSelection
                  ? `You switched from recommended branch`
                  : `We selected the nearest branch for faster delivery`}
              </Text>
            </View>
          );
        }

        return null;
      })()}

      {activeTab === 'home' && (
        <View style={styles.header}>
          <RiderStatusPanel />
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.locationContainer, { backgroundColor: colors.surface }]}
            onPress={() => setShowDeliveryModal(true)}
          >
            <View style={[styles.locationIconWrap, { backgroundColor: colors.primary }]}>
              <Feather name="map-pin" size={18} color={colors.background} />
            </View>
            <View style={styles.deliveryTextWrap}>
              <Text style={[styles.deliveryLabel, { color: colors.text }]}>
                {orderMode === 'delivery' ? 'Deliver to' : 'Pick up at'}
              </Text>
              <View style={styles.deliverySubRow}>
                <Text style={[styles.deliveryAddress, { color: colors.heading }]} numberOfLines={1}>
                  {(() => {
                    if (isLocationLoading) return 'Detecting location...';
                    if (!activeAddress) return 'Select Location';
                    return formatAddressForDisplay(activeAddress);
                  })()}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.text} style={{ marginLeft: 2 }} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.notificationButton, { backgroundColor: colors.surface, shadowColor: colors.primary }]}>
              <Feather name="bell" size={18} color={colors.heading} />
              {notificationCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.badgeText, { color: colors.background }]}>{notificationCount > 99 ? '99+' : notificationCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.cartButton, { backgroundColor: colors.surface, shadowColor: colors.primary }]}
              onPress={() => setActiveTab('shopping-cart')}
            >
              <Feather name="shopping-cart" size={18} color={colors.heading} />
              {cartCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.badgeText, { color: colors.background }]}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'home' && (
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.heading }]}>Authentic Japanese</Text>
          <Text style={[styles.title, { color: colors.heading }]}>Food Delivered Fast</Text>
          {isGlobalMode ? (
            <View style={[styles.branchStatusPill, { backgroundColor: 'rgba(107, 114, 128, 0.1)' }]}>
              <Ionicons name="globe-outline" size={14} color="#6B7280" />
              <Text style={[styles.servingFromText, { color: '#6B7280', marginLeft: 6 }]}>
                Full Menu Catalog
              </Text>
            </View>
          ) : selectedBranch ? (
            <View style={[styles.branchStatusPill, { backgroundColor: colors.primary + '1A' }]}>
              <View style={[styles.statusDot, { backgroundColor: selectedBranch.status === 'closed' ? '#FF5252' : '#4CAF50' }]} />
              <Text style={[styles.servingFromText, { color: colors.text }]}>
                Serving From: <Text style={[styles.branchNameBold, { color: colors.heading }]}>{selectedBranch.name}</Text>
                {selectedBranch.status_text && (
                  <Text> • {selectedBranch.status_text}</Text>
                )}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.contentWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.tabContainer, activeTab === 'home' ? styles.visibleTab : styles.hiddenTab]}>
          <View style={styles.searchRow}>
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, shadowColor: colors.primary }]}>
              <Feather name="search" size={18} color={colors.text} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search sushi, ramen..."
                placeholderTextColor={colors.text}
                style={[styles.searchInput, { color: colors.heading }]}
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.filterButton, { backgroundColor: colors.surface, shadowColor: colors.primary }]}
              onPress={() => { /* Toggle filter panel */ }}
            >
              <Feather name="sliders" size={18} color={colors.heading} />
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesScrollWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContent}
            >
              {categoryData.map((cat) => {
                const isActive = cat.id === activeCategory;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveCategory(cat.id);
                    }}
                    style={[
                      styles.categoryCard, 
                      { backgroundColor: colors.surface, shadowColor: colors.primary },
                      isActive && [styles.categoryCardActive, { borderColor: colors.primary, backgroundColor: colors.background }]
                    ]}
                  >
                    <View style={[
                      styles.categoryIconWrap, 
                      { backgroundColor: colors.background },
                      isActive && [styles.categoryIconWrapActive, { borderColor: colors.primary, backgroundColor: colors.background }]
                    ]}>
                      <CategoryIcon cat={cat} isActive={isActive} />
                    </View>
                    <Text style={[styles.categoryName, { color: colors.text }, isActive && [styles.categoryNameActive, { color: colors.heading }]]}>
                      {cat.name}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name="flower"
                        size={12}
                        color={colors.primary}
                        style={{ marginLeft: 6, opacity: 0.8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {products.length === 0 && !isLoadingGPS && !isRefreshing ? (
            <View style={styles.emptyProducts}>
              <Feather name="map-pin" size={40} color="#DCCDBE" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No products available in your area</Text>
              <Text style={styles.emptyText}>We are not delivering to this location yet. Check back soon!</Text>
            </View>
          ) : (
            <RNAnimated.FlatList
              key="grid-2-stable" 
              data={filteredFoods}
              keyExtractor={(item) => item.id}
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              renderItem={({ item }) => (
                <Animated.View 
                  entering={FadeIn.duration(400)}
                >
                  <FoodCard
                    item={item}
                    width={cardWidth}
                    isFavorite={favorites.includes(item.id)}
                    isOpen={!isGlobalMode && isServiceable}
                    catalogMode={catalogMode}
                    onToggleFavorite={handleToggleFavorite}
                    onAddToCart={handleAddToCart}
                    onPress={handleFoodPress}
                  />
                </Animated.View>
              )}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.gridContent, { paddingBottom: contentBottomPadding }]}
              columnWrapperStyle={styles.gridRow}
            />
          )}
        </View>

        <View style={[styles.tabContainer, activeTab === 'stores' ? styles.visibleTab : styles.hiddenTab]}>
          <StoresPanel
            bottomPadding={contentBottomPadding}
            onOrderNow={() => {
              setActiveTab('home');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
          />
        </View>

        <View style={[styles.tabContainer, activeTab === 'heart' ? styles.visibleTab : styles.hiddenTab]}>
          <FavoritesPanel
            items={favoriteFoods}
            bottomPadding={contentBottomPadding}
            onAddToCart={(id) => {
              const food = products.find(p => p.id === id);
              if (food) handleAddToCart(food);
            }}
            onToggleFavorite={handleToggleFavorite}
          />
        </View>

        <View style={[styles.tabContainer, activeTab === 'shopping-cart' ? styles.visibleTab : styles.hiddenTab]}>
          <CartPanel
            bottomPadding={contentBottomPadding}
            onCheckout={handleCheckout}
          />
        </View>

        <View style={[styles.tabContainer, activeTab === 'user' ? styles.visibleTab : styles.hiddenTab]}>
          <ProfilePanel
            bottomPadding={contentBottomPadding}
          />
        </View>
      </View>

      {!isKeyboardVisible && (
        <BottomNav
          navBottomOffset={navBottomOffset}
          activeTab={activeTab}
          onTabPress={handleTabPress}
          favoritesCount={favoritesCount}
          cartCount={cartCount}
        />
      )}

      <Animated.View style={flyStyle}>
        <Feather name="plus" size={16} color={colors.background} />
      </Animated.View>

      <DeliveryDetailsModal
        visible={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        onAddAddress={() => {
          setShowDeliveryModal(false);
          router.push('/addresses' as any);
        }}
      />

      <FoodDetailModal
        visible={showDetailModal}
        item={selectedFood}
        isFavorite={selectedFood ? favorites.includes(selectedFood.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onClose={() => setShowDetailModal(false)}
        onAddToCart={handleAddToCart}
        catalogMode={catalogMode}
        onCheckout={() => {
          setShowDetailModal(false);
          setActiveTab('shopping-cart');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D38C9D', // Will be overridden
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 10,
  },
  deliveryTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  deliveryLabel: {
    fontSize: 10,
    color: '#7A5560', // Body Mauve
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deliverySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  deliveryAddress: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#000', // Dynamic
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D38C9D', // Dynamic
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D38C9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D38C9D', // Dynamic
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D38C9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#D38C9D', // Antique Rose
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  titleWrap: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000', // Dynamic
    lineHeight: 34,
    fontFamily: 'Outfit_800ExtraBold',
  },
  branchStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  servingFromText: {
    fontSize: 12,
    color: '#2E7D32',
    fontFamily: 'Outfit_500Medium',
  },
  branchNameBold: {
    fontWeight: '700',
  },
  contentWrap: {
    flex: 1,
  },
  tabContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  visibleTab: {
    opacity: 1,
    zIndex: 1,
  },
  hiddenTab: {
    opacity: 0,
    zIndex: 0,
    pointerEvents: 'none',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D38C9D', // Blush
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#D38C9D',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#4A2C35', // Mauve
    fontWeight: '500',
    fontFamily: 'Outfit_500Medium',
  },
  filterButton: {
    width: 52,
    height: 52,
    backgroundColor: '#D38C9D', // Blush
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D38C9D',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  categoriesScrollWrap: {
    marginBottom: 20,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D38C9D', // Blush
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#D38C9D',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  categoryCardActive: {
    borderColor: '#D38C9D', // Antique Rose
    backgroundColor: '#FBEAD6', // Champagne for active pill
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FBEAD6', // Champagne
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  categoryIconWrapActive: {
    backgroundColor: '#FBEAD6',
    borderWidth: 2,
    borderColor: '#D38C9D', // Antique Rose
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A5560', // Body Mauve
    fontFamily: 'Outfit-Regular',
  },
  categoryNameActive: {
    color: '#4A2C35', // Heading Mauve
    fontWeight: '700',
  },
  sakuraDecoration: {
    position: 'absolute',
    top: -8,
    right: -4,
    transform: [{ rotate: '20deg' }],
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 2,
    shadowColor: '#D94F3D',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  gridContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emptyProducts: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    color: '#8A8A8A',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
    lineHeight: 20,
  },
  outsideRadiusBanner: {
    backgroundColor: '#FF5252',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
    minHeight: 44,
  },
  outsideRadiusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit-Regular',
    flex: 1,
    lineHeight: 16,
  },
  softMenuBanner: {
    backgroundColor: '#8A8A8A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
    minHeight: 44,
  },
  softMenuText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
    fontFamily: 'Outfit-Regular',
  },
  globalModeBanner: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
    minHeight: 44,
  },
  globalModeBannerText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
    fontFamily: 'Outfit-Regular',
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D38C9D', // Antique Rose
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  smartMessageBanner: {
    backgroundColor: '#D38C9D', // Blush
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#D38C9D',
  },
  smartMessageText: {
    color: '#4A2C35', // Mauve
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    lineHeight: 16,
    fontFamily: 'Outfit_700Bold',
  },
});

