import { Feather, FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatPeso, resolveProductImage, type Food } from '@/lib/menu_store';
import { type CatalogMode } from '@/state/reducers/branchReducer';

type FoodCardProps = {
  item: Food;
  width: number;
  isFavorite: boolean;
  onToggleFavorite: (foodId: string) => void;
  onAddToCart: (item: Food) => void;
  onPress: (item: Food) => void;
  isOpen: boolean;
  catalogMode: CatalogMode;
};

const FoodCard = memo(function FoodCard({
  item,
  width,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onPress,
  isOpen,
  catalogMode,
}: FoodCardProps) {
  const isGlobalMode = catalogMode === 'global';
  const stockCount = Number(item.stock ?? 0);
  const isAvailableAtBranch = item.is_available;
  const isAvailable = !isGlobalMode && isOpen && stockCount > 0 && isAvailableAtBranch;

  // 🍱 UI FORMATTING (Formatting only at the UI layer)
  const displayPrice = formatPeso(item.selling_price);
  const displayImage = resolveProductImage(item.image_path);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.foodCard, { width }]}
      onPress={() => onPress(item)}
    >
      <View style={[styles.foodImageWrap, !displayImage && { backgroundColor: '#FBEAD6', justifyContent: 'center', alignItems: 'center' }]}>
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={styles.foodImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Feather name="image" size={24} color="#C87D87" />
        )}

        {/* Global Mode Badge */}
        {isGlobalMode && (
          <View style={styles.browseBadge}>
            <Text style={styles.browseText}>Catalog</Text>
          </View>
        )}
      </View>

      <View style={[styles.foodCardBody, (!isAvailable && !isGlobalMode) && { opacity: 0.7 }]}>
        <Text style={styles.foodTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.priceText}>{displayPrice}</Text>

        <View style={styles.descriptionArea}>
          <Text style={styles.foodDescription} numberOfLines={2}>
            {item.description || ""}
          </Text>
        </View>
        
        <View style={styles.foodBottomRow}>
          {isGlobalMode ? (
            <View style={styles.viewIcon}>
               <Feather name="eye" size={18} color="#C87D87" />
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={isAvailable ? 0.8 : 1}
              style={[styles.addIconButton, !isAvailable && styles.addIconButtonDisabled]}
              onPress={() => isAvailable ? onAddToCart(item) : null}
              disabled={!isAvailable}
            >
              <Feather name="plus" size={20} color="#FBEAD6" />
            </TouchableOpacity>
          )}
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
          color={isFavorite ? '#C87D87' : '#7A5560'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  foodCard: {
    backgroundColor: '#F0C4CB', // 30% Blush
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#C87D87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  foodCardBody: {
    padding: 12,
  },
  foodImageWrap: {
    width: '100%',
    aspectRatio: 1.1,
    borderRadius: 18,
    marginBottom: 4,
    overflow: 'hidden',
    backgroundColor: '#FBEAD6', // 60% Champagne
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A2C35', // Heading Mauve
    marginBottom: 2,
    fontFamily: 'Outfit-Bold',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C87D87', // Antique Rose
    marginBottom: 6,
    fontFamily: 'Outfit-Regular',
  },
  foodDescription: {
    fontSize: 11,
    color: '#7A5560', // Body Mauve
    lineHeight: 15,
    fontFamily: 'Outfit-Regular',
},
descriptionArea: {
    height: 38,
    justifyContent: 'flex-start',
},
  foodBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  addIconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#C87D87', // Antique Rose
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  viewIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FBEAD6', // Champagne
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 234, 214, 0.9)', // Champagne
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C87D87',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 5,
  },
  browseBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  browseText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});

export default FoodCard;
