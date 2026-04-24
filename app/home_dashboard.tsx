import { fetchUserFavorites, toggleUserFavorite } from '@/lib/auth_api';
import { useMenuStore, refreshMenuStore, type Food } from '@/lib/menu_store';
import {
  addToCart,
  formatAddressForDisplay,
  setFavorites,
  toggleFavorite,
  useUiStore,
  validateCartAgainstMenu
} from '@/lib/ui_store';
import { useLocationDetection } from '@/hooks/useLocationDetection';
import { getDistanceKm } from '@/lib/google_location';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Animated as RNAnimated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Components
import CartPanel from '../components/CartPanel';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';
import FavoritesPanel from '../components/FavoritesPanel';
import FoodDetailModal from '../components/FoodDetailModal';
import ProfilePanel from '../components/ProfilePanel';
import StoresPanel from '../components/StoresPanel';
import FoodCard from '../components/FoodCard';
import BottomNav, { type NavTab } from '../components/BottomNav';
import CategoryIcon from '../components/CategoryIcon';

type FilterMode = 'default' | 'low_price' | 'high_calorie' | 'favorites';
type PriceRange = 'all' | 'under_8' | '8_to_10' | 'above_10';

const NAV_HEIGHT = 60;
const BOTTOM_NAV_WIDTH = 300;
const TAB_BUTTON_SIZE = 40;

const getPriceValue = (price: string): number =>
  Number(price.replace('\u20B1', '').replace(',', '').trim());
const getCaloriesValue = (calories: string): number => Number(calories.replace(' kcal', ''));

export default function HomeDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { categories: categoryData, menuItems: products } = useMenuStore();
  const { 
    userId, favorites, cartItems, addresses, activeAddressId, selectedBranch, 
    orderMode, isLocationLoading 
  } = useUiStore();
  const { detectLocation, isLoadingGPS } = useLocationDetection();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const favoritesCount = favorites.length;
  
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<NavTab>((params.tab as NavTab) ?? 'home');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [notificationCount] = useState<number>(3);
  const [filterMode, setFilterMode] = useState<FilterMode>('default');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top;
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

  // Initial Data Loading
  useEffect(() => {
    const loadData = async () => {
      await detectLocation({ addresses, activeAddressId });
      await refreshMenuStore();
    };
    loadData();
  }, [activeAddressId]);

  // Fetch favorites if logged in
  useEffect(() => {
    if (userId) {
      fetchUserFavorites(userId)
        .then((fetchedFavs) => setFavorites(fetchedFavs))
        .catch((e) => console.log('Failed to hydrate favorites:', e));
    }
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
      const { removedCount } = validateCartAgainstMenu(products);
      if (removedCount > 0) {
        Alert.alert(
          "Menu Updated",
          "Some items in your cart are no longer available at this location and have been removed.",
          [{ text: "OK" }]
        );
      }
    }
  }, [products, activeAddressId]);

  const cardWidth = useMemo(() => {
    const horizontalPadding = 40;
    const totalGap = 24;
    const available = width - horizontalPadding - totalGap;
    return Math.max(140, available / 2 - 8);
  }, [width]);

  const handleToggleFavorite = useCallback((foodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(foodId);
    if (userId) {
      toggleUserFavorite(userId, foodId).catch((e) => console.log('Sync favorite failed:', e));
    }
  }, [userId]);

  const handleAddToCart = useCallback((item: Food, quantity: number = 1) => {
    if (!activeAddress) {
      Alert.alert("Address Required", "Please select a delivery address to check availability and start ordering.", [
        { text: "Cancel", style: "cancel" },
        { text: "Select Address", onPress: () => setShowDeliveryModal(true) }
      ]);
      return;
    }
    const maxQuantity = Number(item.max_quantity ?? item.stock ?? 0);
    const existingQty = cartItems.find((i) => i.id === item.id)?.quantity ?? 0;

    if (existingQty + quantity > maxQuantity) {
      Alert.alert('Maximum reached', 'Maximum available quantity reached');
      return;
    }

    const result = addToCart(item.id, quantity, maxQuantity, {
      title: item.title,
      price: item.price,
      image: item.image,
      description: item.description
    });

    if (!result.ok) {
      Alert.alert('Maximum reached', result.message || 'Maximum available quantity reached');
      return;
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    triggerFlyAnimation();
  }, [cartItems, triggerFlyAnimation]);

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

  const activeAddress = useMemo(
    () => addresses.find((a) => a.id === activeAddressId),
    [addresses, activeAddressId]
  );

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
    if (activeCategory !== 'All') {
      list = list.filter(f => f.category === activeCategory);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(f => f.title.toLowerCase().includes(s) || f.category.toLowerCase().includes(s));
    }
    if (priceRange !== 'all') {
      list = list.filter(f => {
        const v = getPriceValue(f.price);
        if (priceRange === 'under_8') return v < 450;
        if (priceRange === '8_to_10') return v >= 450 && v <= 550;
        return v > 550;
      });
    }
    if (filterMode === 'low_price') {
      list = [...list].sort((a, b) => getPriceValue(a.price) - getPriceValue(b.price));
    } else if (filterMode === 'high_calorie') {
      list = [...list].sort((a, b) => getCaloriesValue(b.calories) - getCaloriesValue(a.calories));
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
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FB" />

      {isOutsideRadius && activeAddress && (
        <View style={styles.outsideRadiusBanner}>
          <Ionicons name="warning" size={18} color="#FFF" />
          <Text style={styles.outsideRadiusText}>
            Outside delivery area ({distanceToBranch?.toFixed(1)}km). Items may not be deliverable.
          </Text>
        </View>
      )}

      {!activeAddress && !isLocationLoading && (
        <View style={styles.softMenuBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#FFF" />
          <Text style={styles.softMenuText}>
            Menu and pricing may vary by location. Select address to check availability.
          </Text>
        </View>
      )}

      {activeTab === 'home' && (
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.locationContainer}
            onPress={() => setShowDeliveryModal(true)}
          >
            <View style={styles.locationIconWrap}>
              {isLocationLoading ? (
                 <ActivityIndicator size="small" color="#D94F3D" />
              ) : (
                 <Feather name="map-pin" size={18} color="#D94F3D" />
              )}
            </View>
            <View style={styles.deliveryTextWrap}>
              <Text style={styles.deliveryLabel}>
                {orderMode === 'delivery' ? 'Deliver to' : 'Pick up at'}
              </Text>
              <View style={styles.deliverySubRow}>
                <Text style={styles.deliveryAddress} numberOfLines={1}>
                  {(() => {
                    if (isLocationLoading) return 'Detecting location...';
                    if (!activeAddress) return 'Select Location';
                    return formatAddressForDisplay(activeAddress);
                  })()}
                </Text>
                <Feather name="chevron-down" size={14} color="#8A8A8A" style={{ marginLeft: 2 }} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity activeOpacity={0.8} style={styles.notificationButton}>
              <Feather name="bell" size={18} color="#2C2C2C" />
              {notificationCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : notificationCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.cartButton}
              onPress={() => setActiveTab('shopping-cart')}
            >
              <Feather name="shopping-cart" size={18} color="#2C2C2C" />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'home' && (
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Authentic Japanese</Text>
          <Text style={styles.title}>Food Delivered Fast</Text>
          {selectedBranch && (
            <View style={styles.branchStatusPill}>
              <View style={[styles.statusDot, { backgroundColor: selectedBranch.status === 'closed' ? '#FF5252' : '#4CAF50' }]} />
              <Text style={styles.servingFromText}>
                Serving From: <Text style={styles.branchNameBold}>{selectedBranch.name}</Text>
                {selectedBranch.status_text && (
                   <Text> • {selectedBranch.status_text}</Text>
                )}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.contentWrap}>
        <View style={[styles.tabContainer, activeTab === 'home' ? styles.visibleTab : styles.hiddenTab]}>
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#8A8A8A" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search sushi, ramen..."
                placeholderTextColor="#8A8A8A"
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.filterButton}
              onPress={() => { /* Toggle filter panel */ }}
            >
              <Feather name="sliders" size={18} color="#2C2C2C" />
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesScrollWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContent}
            >
              {categoryData.map((cat) => {
                const isActive = cat.name === activeCategory;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.8}
                    onPress={() => setActiveCategory(cat.name)}
                    style={[styles.categoryCard, isActive && styles.categoryCardActive]}
                  >
                    <View style={[styles.categoryIconWrap, isActive && styles.categoryIconWrapActive]}>
                      <CategoryIcon cat={cat} isActive={isActive} />
                    </View>
                    <Text style={[styles.categoryName, isActive && styles.categoryNameActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {products.length === 0 && !isLoadingGPS ? (
            <View style={styles.emptyProducts}>
              <Feather name="map-pin" size={40} color="#DCCDBE" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No products available in your area</Text>
              <Text style={styles.emptyText}>We are not delivering to this location yet. Check back soon!</Text>
            </View>
          ) : (
            <RNAnimated.FlatList
              data={filteredFoods}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FoodCard
                  item={item}
                  width={cardWidth}
                  isFavorite={favorites.includes(item.id)}
                  isOpen={isOpen}
                  onToggleFavorite={handleToggleFavorite}
                  onAddToCart={handleAddToCart}
                  onPress={handleFoodPress}
                />
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
        <Feather name="plus" size={16} color="#FFF" />
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
    backgroundColor: '#F8F9FB',
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
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F1E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 10,
  },
  deliveryTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  deliveryLabel: {
    fontSize: 10,
    color: '#8A8A8A',
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
    color: '#2C2C2C',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#D94F3D',
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
    color: '#2C2C2C',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#2C2C2C',
    fontWeight: '500',
    fontFamily: 'Outfit_500Medium',
  },
  filterButton: {
    width: 52,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  categoryCardActive: {
    borderColor: '#D94F3D',
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  categoryIconWrapActive: {
    backgroundColor: '#FDECEB',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A8A',
    fontFamily: 'Outfit_600SemiBold',
  },
  categoryNameActive: {
    color: '#D94F3D',
    fontWeight: '700',
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
    paddingVertical: 8,
    gap: 10,
  },
  outsideRadiusText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
  },
  softMenuBanner: {
    backgroundColor: '#8A8A8A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  softMenuText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDECEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
});
