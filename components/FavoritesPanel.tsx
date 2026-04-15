import type { Food } from '@/lib/menu_store';
import { clearFavorites } from '@/lib/ui_store';
import { Feather, FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <View style={styles.favoriteCard}>
      {item.image ? (
        <Image source={item.image} style={styles.favoriteImage} resizeMode="cover" />
      ) : (
        <View style={styles.favoriteImage} />
      )}
      <View style={styles.favoriteInfo}>
        <Text style={styles.favoriteTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.categoryPill}>
          <Text style={styles.favoriteCategory}>{item.category}</Text>
        </View>
        <Text style={styles.favoritePrice}>{item.price}</Text>
      </View>
      <View style={styles.favoriteActions}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.favoriteHeartBtn}
          onPress={() => onToggleFavorite(item.id)}
        >
          <FontAwesome name="heart" size={14} color="#D94F3D" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.favoriteActionBtn}
          onPress={() => onAddToCart(item.id)}
        >
          <Feather name="plus" size={16} color="#FFF" />
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
  return (
    <View style={styles.favoritesContainer}>
      <View style={styles.favoritesHeader}>
        <View>
          <Text style={styles.favoritesTitle}>Favorites</Text>
          <Text style={styles.favoritesSubtitle}>Curated Japanese picks for your next order</Text>
        </View>
        <View style={styles.headerRightActions}>
          <View style={styles.favoritesCountPill}>
            <Text style={styles.favoritesCount}>{items.length} items</Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllBtn}
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
              <Feather name="trash-2" size={20} color="#D94F3D" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {items.length === 0 ? (
        <View style={styles.emptyFavorites}>
          <View style={styles.emptyIconWrap}>
            <FontAwesome name="heart-o" size={24} color="#B2A79A" />
          </View>
          <Text style={styles.emptyFavoritesText}>No saved dishes yet</Text>
          <Text style={styles.emptyFavoritesSubText}>
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
    backgroundColor: '#F8F9FB',
  },
  favoritesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  favoritesTitle: {
    color: '#2C2C2C',
    fontSize: 24,
    fontWeight: '700',
  },
  favoritesSubtitle: {
    marginTop: 4,
    color: '#7D746A',
    fontSize: 12,
  },
  favoritesCountPill: {
    marginTop: 2,
    borderRadius: 14,
    backgroundColor: '#ECE4D6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2D9CA',
  },
  favoritesCount: {
    color: '#6E665D',
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
    backgroundColor: '#FDDAD8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteListContent: {
    paddingBottom: 10,
  },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FCF9F3',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE4D6',
    shadowColor: '#8B7960',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  favoriteImage: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: '#EFEAE0',
  },
  favoriteInfo: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  favoriteTitle: {
    color: '#2A2724',
    fontWeight: '700',
    fontSize: 15,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    marginTop: 7,
    borderRadius: 10,
    backgroundColor: '#EFE6D8',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  favoriteCategory: {
    color: '#7B6D5F',
    fontSize: 11,
  },
  favoritePrice: {
    color: '#1F1C19',
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
    backgroundColor: '#D94F3D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D94F3D',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  favoriteHeartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F3',
    borderWidth: 1,
    borderColor: '#F2D4CE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFavorites: {
    marginTop: 36,
    backgroundColor: '#FCF9F3',
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE4D6',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3ECE0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFavoritesText: {
    marginTop: 10,
    color: '#2A2724',
    fontSize: 17,
    fontWeight: '700',
  },
  emptyFavoritesSubText: {
    marginTop: 6,
    color: '#867D74',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
