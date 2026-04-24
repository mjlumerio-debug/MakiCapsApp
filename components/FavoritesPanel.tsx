import type { Food } from '@/lib/menu_store';
import { clearFavorites } from '@/lib/ui_store';
import { Feather, FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { formatPeso, resolveProductImage } from '@/lib/menu_store';

type FavoritesPanelProps = {
  items: Food[];
  bottomPadding: number;
  onAddToCart: (foodId: string) => void;
  onToggleFavorite: (foodId: string) => void;
};

type FavoriteRowProps = {
  item: Food;
  onToggleFavorite: (foodId: string) => void;
  onAddToCart: (foodId: string) => void;
};

function FavoriteRow({ item, onToggleFavorite, onAddToCart }: FavoriteRowProps) {
  const { colors } = useAppTheme();
  const displayImage = resolveProductImage(item.image_path);
  const displayPrice = formatPeso(item.selling_price);

  return (
    <View style={[styles.favoriteCard, { backgroundColor: colors.surface, borderColor: colors.primary + '1A', shadowColor: colors.primary }]}>
      {displayImage ? (
        <Image source={{ uri: displayImage }} style={styles.favoriteImage} resizeMode="cover" />
      ) : (
        <View style={[styles.favoriteImage, { backgroundColor: colors.background }]} />
      )}
      <View style={styles.favoriteInfo}>
        <Text style={[styles.favoriteTitle, { color: colors.heading }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.categoryPill, { backgroundColor: colors.background }]}>
          <Text style={[styles.favoriteCategory, { color: colors.text }]}>{item.category_name}</Text>
        </View>
        <Text style={[styles.favoritePrice, { color: colors.primary }]}>{displayPrice}</Text>
      </View>
      <View style={styles.favoriteActions}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.favoriteHeartBtn, { backgroundColor: colors.background, borderColor: colors.primary + '33' }]}
          onPress={() => onToggleFavorite(item.id)}
        >
          <FontAwesome name="heart" size={14} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.favoriteActionBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          onPress={() => onAddToCart(item.id)}
        >
          <Feather name="plus" size={16} color={colors.background} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FavoritesPanel({
  items,
  bottomPadding,
  onAddToCart,
  onToggleFavorite,
}: FavoritesPanelProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.favoritesContainer, { backgroundColor: colors.background }]}>
      <View style={styles.favoritesHeader}>
        <View>
          <Text style={[styles.favoritesTitle, { color: colors.heading }]}>Favorites</Text>
          <Text style={[styles.favoritesSubtitle, { color: colors.text }]}>Curated Japanese picks for your next order</Text>
        </View>
        <View style={styles.headerRightActions}>
          <View style={[styles.favoritesCountPill, { backgroundColor: colors.surface, borderColor: colors.primary + '1A' }]}>
            <Text style={[styles.favoritesCount, { color: colors.heading }]}>{items.length} items</Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity
              style={[styles.clearAllBtn, { backgroundColor: colors.surface }]}
              onPress={() => {
                Alert.alert(
                  "Clear Favorites",
                  "Are you sure you want to remove all items from your favorites?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear All", style: "destructive", onPress: () => clearFavorites() }
                  ]
                );
              }}
            >
              <Feather name="trash-2" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {items.length === 0 ? (
        <View style={[styles.emptyFavorites, { backgroundColor: colors.surface, borderColor: colors.primary + '1A' }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.background }]}>
            <FontAwesome name="heart-o" size={24} color={colors.text} />
          </View>
          <Text style={[styles.emptyFavoritesText, { color: colors.heading }]}>No saved dishes yet</Text>
          <Text style={[styles.emptyFavoritesSubText, { color: colors.text }]}>
            Tap the heart icon on any menu item to build your cozy favorites list.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FavoriteRow
              item={item}
              onAddToCart={onAddToCart}
              onToggleFavorite={onToggleFavorite}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.favoriteListContent, { paddingBottom: bottomPadding }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  favoritesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  favoritesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  favoritesTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  favoritesSubtitle: {
    marginTop: 4,
    fontSize: 12,
  },
  favoritesCountPill: {
    marginTop: 2,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  favoritesCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearAllBtn: {
    marginLeft: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteListContent: {
    paddingBottom: 10,
  },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  favoriteImage: {
    width: 78,
    height: 78,
    borderRadius: 14,
  },
  favoriteInfo: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  favoriteTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    marginTop: 7,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  favoriteCategory: {
    fontSize: 11,
  },
  favoritePrice: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  favoriteActions: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  favoriteActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  favoriteHeartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFavorites: {
    marginTop: 36,
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFavoritesText: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyFavoritesSubText: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
