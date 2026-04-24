import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { memo, useEffect, useRef } from 'react';
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 310,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#D94F3D',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});

export default BottomNav;
