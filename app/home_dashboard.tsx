import { fetchUserFavorites, toggleUserFavorite } from '@/lib/auth_api';
import { ensureMenuStoreLoaded, useMenuStore, type Food, type Category } from '@/lib/menu_store';
import { addToCart, setFavorites, toggleFavorite, useUiStore } from '@/lib/ui_store';
import { Feather, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Animated as RNAnimated,
  Easing as RNEasing,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Keyboard
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import CartPanel from '../components/CartPanel';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';
import FavoritesPanel from '../components/FavoritesPanel';
import FoodDetailModal from '../components/FoodDetailModal';
import ProfilePanel from '../components/ProfilePanel';
import StoresPanel from '../components/StoresPanel';

type NavTab = 'home' | 'stores' | 'heart' | 'shopping-cart' | 'user';
type FilterMode = 'default' | 'low_price' | 'high_calorie' | 'favorites';
type PriceRange = 'all' | 'under_8' | '8_to_10' | 'above_10';
type FilterState = {
  category: string;
  search: string;
  mode: FilterMode;
  favorites: string[];
  priceRange: PriceRange;
};

type FoodCardProps = {
  item: Food;
  width: number;
  isFavorite: boolean;
  onToggleFavorite: (foodId: string) => void;
  onAddToCart: (foodId: string) => void;
  onPress: (item: Food) => void;
};
type BottomNavProps = {
  navBottomOffset: number;
  activeTab: NavTab;
  onTabPress: (tab: NavTab) => void;
  favoritesCount: number;
  cartCount: number;
  openLogoutSheet?: () => void;
};

const navTabs: NavTab[] = ['home', 'heart', 'shopping-cart', 'stores', 'user'];
const priceRanges: { id: PriceRange; label: string }[] = [
  { id: 'all', label: 'All Prices' },
  { id: 'under_8', label: 'Under ₱450' },
  { id: '8_to_10', label: '₱450 - ₱550' },
  { id: 'above_10', label: 'Above ₱550' },
];
const NAV_HEIGHT = 60;
const NAV_BOTTOM_IOS = 34;
const NAV_BOTTOM_ANDROID = 46;
const BOTTOM_NAV_WIDTH = 300;
const TAB_BUTTON_SIZE = 40;
const MENU_CARD_HEIGHT = 238;

const getPriceValue = (price: string): number =>
  Number(price.replace('\u20B1', '').replace(',', '').trim());
const getCaloriesValue = (calories: string): number => Number(calories.replace(' kcal', ''));

const filterByCategory = (list: Food[], category: string): Food[] => {
  if (category === 'All') return list;
  return list.filter((food) => food.category === category);
};

const filterBySearch = (list: Food[], search: string): Food[] => {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return list;
  return list.filter(
    (food) =>
      food.title.toLowerCase().includes(normalizedSearch) ||
      food.category.toLowerCase().includes(normalizedSearch)
  );
};

const filterByFavorites = (list: Food[], favorites: string[]): Food[] =>
  list.filter((food) => favorites.includes(food.id));

const filterByPriceRange = (list: Food[], priceRange: PriceRange): Food[] => {
  if (priceRange === 'all') return list;

  return list.filter((food) => {
    const value = getPriceValue(food.price);
    if (priceRange === 'under_8') return value < 450;
    if (priceRange === '8_to_10') return value >= 450 && value <= 550;
    return value > 550;
  });
};

const sortByMode = (list: Food[], mode: FilterMode): Food[] => {
  if (mode === 'low_price') {
    return [...list].sort((a, b) => getPriceValue(a.price) - getPriceValue(b.price));
  }

  if (mode === 'high_calorie') {
    return [...list].sort(
      (a, b) => getCaloriesValue(b.calories) - getCaloriesValue(a.calories)
    );
  }

  return list;
};

const applyAllFilters = (list: Food[], state: FilterState): Food[] => {
  const byCategory = filterByCategory(list, state.category);
  const bySearch = filterBySearch(byCategory, state.search);
  const byPriceRange = filterByPriceRange(bySearch, state.priceRange);

  if (state.mode === 'favorites') {
    return filterByFavorites(byPriceRange, state.favorites);
  }

  return sortByMode(byPriceRange, state.mode);
};

const FoodCard = memo(function FoodCard({
  item,
  width,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onPress,
}: FoodCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.foodCard, { width }]}
      onPress={() => onPress(item)}
    >
      <View style={styles.foodCardBody}>
        <View style={[styles.foodImageWrap, !item.image && { backgroundColor: '#F3ECE0', justifyContent: 'center', alignItems: 'center' }]}>
          {item.image ? (
            <Image
              source={item.image}
              style={styles.foodImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Feather name="image" size={24} color="#DCCDBE" />
          )}
        </View>

        <Text style={styles.foodTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.priceBelowTitle}>{item.price}</Text>

        {item.description ? (
          <Text style={styles.foodDescription} numberOfLines={2}>
            {item.description.split(' ').slice(0, 7).join(' ')}
            {item.description.split(' ').length > 7 ? '...' : ''}
          </Text>
        ) : null}

        <View style={styles.foodBottomRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.addIconButton}
            onPress={() => onAddToCart(item.id)}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.heartButton}
        onPress={() => onToggleFavorite(item.id)}
      >
        <FontAwesome
          name={isFavorite ? 'heart' : 'heart-o'}
          size={16}
          color={isFavorite ? '#D94F3D' : '#8A8A8A'}
        />
      </TouchableOpacity>
    </TouchableOpacity >
  );
});

const CategoryIcon = memo(function CategoryIcon({ cat, isActive }: { cat: Category; isActive: boolean }) {
  const [imageError, setImageError] = useState(false);

  if (cat.image_path && !imageError) {
    return (
      <Image
        source={{ uri: cat.image_path }}
        style={styles.categoryImage}
        contentFit="cover"
        transition={200}
        onError={() => {
          console.log(`Image load failed for ${cat.name}`);
          setImageError(true);
        }}
        onLoad={() => console.log(`Image loaded successfully for ${cat.name}`)}
      />
    );
  }

  return <Feather name="tag" size={14} color={isActive ? "#D94F3D" : "#8A8A8A"} />;
});

const BottomNav = memo(function BottomNav({
  navBottomOffset,
  activeTab,
  onTabPress,
  favoritesCount,
  cartCount,
  openLogoutSheet,
}: BottomNavProps) {
  const tabAnimations = useRef<Record<NavTab, RNAnimated.Value>>({
    home: new RNAnimated.Value(activeTab === 'home' ? 1 : 0),
    stores: new RNAnimated.Value(activeTab === 'stores' ? 1 : 0),
    heart: new RNAnimated.Value(activeTab === 'heart' ? 1 : 0),
    'shopping-cart': new RNAnimated.Value(activeTab === 'shopping-cart' ? 1 : 0),
    user: new RNAnimated.Value(activeTab === 'user' ? 1 : 0),
  });

  useEffect(() => {
    RNAnimated.parallel(
      navTabs.map((tab) =>
        RNAnimated.timing(tabAnimations.current[tab], {
          toValue: tab === activeTab ? 1 : 0,
          duration: 260,
          easing: RNEasing.out(RNEasing.quad),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [activeTab]);

  return (
    <View style={[styles.bottomNav, { bottom: navBottomOffset }]}>
      {navTabs.map((tab) => {
        const activeProgress = tabAnimations.current[tab];
        const inactiveProgress = activeProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
        });
        const activeScale = activeProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        });

        return (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.8}
            onPress={() => onTabPress(tab)}
            style={styles.navTabButton}
          >
            <RNAnimated.View
              pointerEvents="none"
              style={[
                styles.navTabActiveBg,
                {
                  opacity: activeProgress,
                  transform: [{ scale: activeScale }],
                },
              ]}
            />
            <View style={styles.navIconWrap}>
              <RNAnimated.View style={[styles.navIconLayer, { opacity: inactiveProgress }]}>
                {tab === 'stores' ? (
                  <MaterialCommunityIcons name="store" size={20} color="#8A8A8A" />
                ) : (
                  <Feather 
                    name={
                      tab === 'shopping-cart' ? 'shopping-cart' : 
                      tab === 'heart' ? 'heart' : 
                      tab as any
                    } 
                    size={18} 
                    color="#8A8A8A" 
                  />
                )}
              </RNAnimated.View>
              <RNAnimated.View style={[styles.navIconLayer, { opacity: activeProgress }]}>
                {tab === 'stores' ? (
                  <MaterialCommunityIcons name="store" size={20} color="#FFFFFF" />
                ) : (
                  <Feather 
                    name={
                      tab === 'shopping-cart' ? 'shopping-cart' : 
                      tab === 'heart' ? 'heart' : 
                      tab as any
                    } 
                    size={18} 
                    color="#FFFFFF" 
                  />
                )}
              </RNAnimated.View>
            </View>

            {tab === 'heart' && favoritesCount > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText} numberOfLines={1}>
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </Text>
              </View>
            )}

            {tab === 'shopping-cart' && cartCount > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText} numberOfLines={1}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});


export default function HomeDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { categories: categoryData, menuItems: menuData } = useMenuStore();
  const { userId, favorites, cartItems, addresses, activeAddressId } = useUiStore();
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const favoritesCount = favorites.length;
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<NavTab>((params.tab as NavTab) ?? 'home');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [notificationCount] = useState<number>(3);
  const [filterMode, setFilterMode] = useState<FilterMode>('default');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState<boolean>(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Sync activeTab with URL params
  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab as NavTab);
    }
  }, [params.tab]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [cart, setCart] = useState<Food[]>([]);
  const contentOpacity = useRef(new RNAnimated.Value(1)).current;
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const navBottomOffset = Platform.OS === 'android' ? NAV_BOTTOM_ANDROID : NAV_BOTTOM_IOS;
  const contentBottomPadding = NAV_HEIGHT + navBottomOffset + 24;

  // Fly-to-cart animation logic
  const flyX = useSharedValue(0);
  const flyY = useSharedValue(0);
  const flyScale = useSharedValue(0);
  const flyOpacity = useSharedValue(0);

  const triggerFlyAnimation = useCallback(() => {
    const { width: W_WIDTH, height: W_HEIGHT } = Dimensions.get('window');
    // Start from center
    flyX.value = W_WIDTH / 2;
    flyY.value = W_HEIGHT / 2;
    flyScale.value = 0.5;
    flyOpacity.value = 1;

    // Fly to cart icon (roughly top right)
    const targetX = W_WIDTH - 45;
    const targetY = topInset + 40;

    flyX.value = withTiming(targetX, { duration: 600, easing: Easing.inOut(Easing.quad) });
    flyY.value = withTiming(targetY, { duration: 600, easing: Easing.inOut(Easing.quad) });
    flyScale.value = withTiming(1.2, { duration: 300 }, (finished) => {
      if (finished) flyScale.value = withTiming(0, { duration: 300 });
    });
    flyOpacity.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.exp) });
  }, [topInset]);

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

  // --- Animations removed for instant feel ---
  const headerAnim = useRef(new RNAnimated.Value(1)).current;
  const titleAnim = useRef(new RNAnimated.Value(1)).current;
  const searchAnim = useRef(new RNAnimated.Value(1)).current;
  const catsAnim = useRef(new RNAnimated.Value(1)).current;
  const gridAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    // No animations as per user request
  }, []);

  const makeEntrance = (anim: RNAnimated.Value, offsetY = 24) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) }],
  });

  useEffect(() => {
    ensureMenuStoreLoaded();
  }, []);

  // Fetch initial favorites if logged in
  useEffect(() => {
    if (userId) {
      fetchUserFavorites(userId)
        .then((fetchedFavs) => {
          setFavorites(fetchedFavs);
        })
        .catch((e) => console.log('Failed to hydrate favorites:', e));
    }
  }, [userId]);

  const cardWidth = useMemo(() => {
    const horizontalPadding = 40;
    const totalGap = 24;
    const available = width - horizontalPadding - totalGap;
    return Math.max(150, available / 2);
  }, [width]);

  const handleCategoryFilter = useCallback((categoryName: string) => {
    setActiveCategory(categoryName);
  }, []);


  const handleToggleFavorite = useCallback((foodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(foodId); // Optimistic UI update
    if (userId) {
      toggleUserFavorite(userId, foodId).catch((e) => {
        console.log('Failed to sync favorite toggle:', e);
        // Revert UI theoretically, but omitting for simplicity here
      });
    }
  }, [userId]);

  const handleAddToCart = useCallback((foodId: string, quantity: number = 1) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart(foodId, quantity);
    triggerFlyAnimation();
  }, [triggerFlyAnimation]);

  const handleFilterPress = useCallback(() => {
    setShowFilterPanel((prev) => !prev);
  }, []);

  const handlePriceRangeFilter = useCallback((range: PriceRange) => {
    setPriceRange(range);
  }, []);
  const handleResetFilters = useCallback(() => {
    setActiveCategory('All');
    setSearch('');
    setPriceRange('all');
    setFilterMode('default');
    setShowFilterPanel(false);
  }, []);

  const handleFoodPress = useCallback((item: Food) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood(item);
    setShowDetailModal(true);
  }, []);

  const handleAddToCartLocal = useCallback((item: Food, quantity: number = 1) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart(item.id, quantity); // Sync with store
    triggerFlyAnimation();
  }, [triggerFlyAnimation]);

  const handleCheckout = useCallback(() => {
    const checkedCartItems = cartItems.filter((i: any) => i.checked);
    const checkoutData = checkedCartItems.map(cartItem => ({
      id: cartItem.id,
      quantity: cartItem.quantity
    }));

    setShowDetailModal(false);
    setTimeout(() => {
      // @ts-ignore
      router.push({
        pathname: '/checkout',
        params: { cart: JSON.stringify(checkoutData) }
      });
    }, 300);
  }, [cartItems, menuData, router]);

  const handleTabPress = useCallback(
    (tab: NavTab) => {
      if (tab === activeTab) return;

      // Instant switch: No animations as per user request
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
      setShowFilterPanel(false); 
      contentOpacity.setValue(1);
    },
    [activeTab, contentOpacity, router]
  );

  const filteredFoods = useMemo(() => {
    return applyAllFilters(menuData, {
      category: activeCategory,
      search,
      mode: filterMode,
      favorites,
      priceRange,
    });
  }, [activeCategory, favorites, filterMode, menuData, priceRange, search]);

  const favoriteFoods = useMemo(
    () => menuData.filter((item) => favorites.includes(item.id)),
    [favorites, menuData]
  );

  const renderFood = useCallback(
    ({ item }: { item: Food }) => (
      <FoodCard
        item={item}
        width={cardWidth}
        isFavorite={favorites.includes(item.id)}
        onToggleFavorite={handleToggleFavorite}
        onAddToCart={handleAddToCart}
        onPress={handleFoodPress}
      />
    ),
    [cardWidth, favorites, handleAddToCart, handleToggleFavorite, handleFoodPress]
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FB" />

      {(activeTab === 'home' || activeTab === 'heart') && (
        <RNAnimated.View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.locationContainer}
            onPress={() => setShowDeliveryModal(true)}
          >
            <Feather name="map-pin" size={18} color="#D94F3D" />
            <View style={styles.deliveryTextWrap}>
              <Text style={styles.deliveryLabel}>Deliver Today</Text>
              <View style={styles.deliverySubRow}>
                <Text style={styles.deliveryAddress} numberOfLines={1}>
                  {(() => {
                    if (!addresses || addresses.length === 0) return 'Add Delivery Address';
                    const active = addresses.find(a => a.id === activeAddressId) || addresses[0];
                    return active.street || active.subdivision || active.fullAddress.split(',')[0] || 'Unnamed Location';
                  })()}
                </Text>
                <Feather name="chevron-down" size={14} color="#8A8A8A" style={{ marginLeft: 2 }} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity activeOpacity={0.8} style={styles.notificationButton}>
              <Feather name="bell" size={18} color="#2C2C2C" />
              {notificationCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : notificationCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.cartButton}
              onPress={() => handleTabPress('shopping-cart')}
            >
              <Feather name="shopping-cart" size={18} color="#2C2C2C" />
              {cartCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </RNAnimated.View>
      )}

      {activeTab === 'home' && (
        <RNAnimated.View style={styles.titleWrap}>
          <Text style={styles.title}>Authentic Japanese</Text>
          <Text style={styles.title}>Food Delivered Fast</Text>
        </RNAnimated.View>
      )}

      <RNAnimated.View
        style={[styles.contentWrap, { opacity: contentOpacity, flex: 1 }]}
      >
        <View style={[styles.tabContainer, activeTab === 'home' ? styles.visibleTab : styles.hiddenTab]}>
            <RNAnimated.View style={[styles.searchRow, makeEntrance(searchAnim, 16)]}>
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
                onPress={handleFilterPress}
              >
                <Feather name="sliders" size={18} color="#2C2C2C" />
              </TouchableOpacity>
            </RNAnimated.View>

            <RNAnimated.View style={[styles.categoriesScrollWrap, makeEntrance(catsAnim, 14)]}>
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
                      onPress={() => handleCategoryFilter(cat.name)}
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
            </RNAnimated.View>

            <RNAnimated.FlatList
              data={filteredFoods}
              keyExtractor={(item) => item.id}
              renderItem={renderFood}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.gridContent, { paddingBottom: contentBottomPadding }]}
              columnWrapperStyle={styles.gridRow}
              style={makeEntrance(gridAnim, 12)}
            />
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
            onAddToCart={handleAddToCart}
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
      </RNAnimated.View>

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
        onAddToCart={handleAddToCartLocal}
        onCheckout={() => {
          setShowDetailModal(false);
          setActiveTab('shopping-cart');
        }}
      />


    </SafeAreaView>
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
  logoutHeaderButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FDECEB',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  adminButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  storeButton: {
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
  },
  contentWrap: {
    flex: 1,
    backgroundColor: '#F8F9FB', // Ensure constant background to prevent flickering
  },
  tabContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8F9FB',
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
    backgroundColor: '#FFFFFF',
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
  categoryIcon: {
    width: 18,
    height: 18,
  },
  categoryImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A8A',
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
    marginBottom: 20,
  },
  foodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  foodCardBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  foodImageWrap: {
    width: '100%',
    aspectRatio: 1.1,
    borderRadius: 20,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
    marginBottom: 12,
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  foodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  foodBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  priceBelowTitle: {
    color: '#D94F3D',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 4,
  },
  foodDescription: {
    color: '#8A8A8A',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  addIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D94F3D',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 10,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    height: NAV_HEIGHT,
    width: BOTTOM_NAV_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 8,
    zIndex: 100,
  },
  navTabButton: {
    width: TAB_BUTTON_SIZE,
    height: TAB_BUTTON_SIZE,
    borderRadius: TAB_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTabActiveBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF5800',
    borderRadius: TAB_BUTTON_SIZE / 2,
  },
  navIconWrap: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  navIconLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconStore: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF5800',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    lineHeight: 12,
  },

  // --- Logout Modal Styles ---
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCenterContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1000,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  logoutIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FDECEB', // Light red tint
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2C2C', // Very dark instead of red
    textAlign: 'center',
    marginBottom: 8,
  },
  logoutSubtitle: {
    fontSize: 15,
    color: '#8A8A8A',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  logoutButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutCancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  logoutConfirmButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#D94F3D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D94F3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
