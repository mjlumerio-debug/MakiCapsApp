import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { memo, useEffect, useRef } from 'react';
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '@/state/contexts/ThemeContext';

export type NavTab = 'home' | 'stores' | 'heart' | 'shopping-cart' | 'user';

type BottomNavProps = {
  navBottomOffset: number;
  activeTab: NavTab;
  onTabPress: (tab: NavTab) => void;
  favoritesCount: number;
  cartCount: number;
};

const navTabs: NavTab[] = ['home', 'heart', 'shopping-cart', 'stores', 'user'];

const BottomNav = memo(function BottomNav({
  navBottomOffset,
  activeTab,
  onTabPress,
  favoritesCount,
  cartCount,
}: BottomNavProps) {
  const { colors } = useAppTheme();
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
    <View style={[
      styles.bottomNav, 
      { 
        bottom: navBottomOffset, 
        backgroundColor: colors.surface + 'F2', // ~95% opacity
        borderColor: colors.primary + '4D', // ~30% opacity
        shadowColor: colors.primary 
      }
    ]}>
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
                  backgroundColor: colors.primary,
                },
              ]}
            />
            <View style={styles.navIconWrap}>
              <RNAnimated.View style={[styles.navIconLayer, { opacity: inactiveProgress }]}>
                {tab === 'stores' ? (
                  <MaterialCommunityIcons name="store" size={20} color={colors.text} />
                ) : (
                  <Feather
                    name={
                      tab === 'shopping-cart' ? 'shopping-cart' :
                        tab === 'heart' ? 'heart' :
                          tab as any
                    }
                    size={18}
                    color={colors.text}
                  />
                )}
              </RNAnimated.View>
              <RNAnimated.View style={[styles.navIconLayer, { opacity: activeProgress }]}>
                {tab === 'stores' ? (
                  <MaterialCommunityIcons name="store" size={20} color={colors.background} />
                ) : (
                  <Feather
                    name={
                      tab === 'shopping-cart' ? 'shopping-cart' :
                        tab === 'heart' ? 'heart' :
                          tab as any
                    }
                    size={18}
                    color={colors.background}
                  />
                )}
              </RNAnimated.View>
            </View>

            {tab === 'heart' && favoritesCount > 0 && (
              <View style={[styles.navBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Text style={[styles.navBadgeText, { color: colors.background }]} numberOfLines={1}>
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </Text>
              </View>
            )}

            {tab === 'shopping-cart' && cartCount > 0 && (
              <View style={[styles.navBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Text style={[styles.navBadgeText, { color: colors.background }]} numberOfLines={1}>
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

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(240, 196, 203, 0.95)', // Blush
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 310,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#D38C9D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 125, 135, 0.3)',
    zIndex: 1000,
  },
  navTabButton: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTabActiveBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D38C9D', // Antique Rose
    borderRadius: 22,
  },
  navIconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#D38C9D', // Antique Rose
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FBEAD6', // Champagne
  },
  navBadgeText: {
    color: '#FBEAD6', // Champagne
    fontSize: 9,
    fontWeight: '800',
  },
});

export default BottomNav;

