import { formatPeso, resolveProductImage, type Food } from '@/lib/menu_store';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { type CatalogMode } from '@/state/reducers/branchReducer';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const { colors } = useAppTheme();
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
      style={[styles.foodCard, { width, backgroundColor: colors.surface, shadowColor: colors.primary }]}
      onPress={() => onPress(item)}
    >
      <View style={[styles.foodImageWrap, { backgroundColor: colors.background }, !displayImage && { justifyContent: 'center', alignItems: 'center' }]}>
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={styles.foodImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Feather name="image" size={24} color={colors.primary} />
        )}

        {/* Availability Badge */}
        <View style={[
          styles.statusBadge, 
          { backgroundColor: item.availability_status === 'available' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)' }
        ]}>
          <Text style={styles.statusBadgeText}>
            {item.availability_status === 'available' ? 'Available' : 'Out of Stock'}
          </Text>
        </View>
      </View>

      <View style={[styles.foodCardBody, (!isAvailable && !isGlobalMode) && { opacity: 0.7 }]}>
        <Text style={[styles.foodTitle, { color: colors.heading }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.priceText, { color: colors.primary }]}>{displayPrice}</Text>

        <View style={styles.descriptionArea}>
          <Text style={[styles.foodDescription, { color: colors.text }]} numberOfLines={2}>
            {item.description || ""}
          </Text>
        </View>

        <View style={styles.foodBottomRow}>
          {isGlobalMode ? (
            <View style={[styles.viewIcon, { backgroundColor: colors.background }]}>
              <Feather name="eye" size={18} color={colors.primary} />
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={isAvailable ? 0.8 : 1}
              style={[styles.addIconButton, { backgroundColor: colors.primary }, !isAvailable && styles.addIconButtonDisabled]}
              onPress={() => isAvailable ? onAddToCart(item) : null}
              disabled={!isAvailable}
            >
              <Feather name="plus" size={20} color={colors.background} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.heartButton, { backgroundColor: colors.background + 'E6', shadowColor: colors.primary }]}
        onPress={() => onToggleFavorite(item.id)}
      >
        <FontAwesome
          name={isFavorite ? 'heart' : 'heart-o'}
          size={16}
          color={isFavorite ? colors.primary : colors.text}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  foodCard: {
    backgroundColor: '#D38C9D', // 30% Blush
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#D38C9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  foodCardBody: {
    padding: 8,
  },
  foodImageWrap: {
    width: '100%',
    aspectRatio: 0.95,
    borderRadius: 20, // Slightly more rounded for cozy feel
    marginBottom: 4,
    overflow: 'hidden',
    backgroundColor: '#FBEAD6', // Cozy Champagne background
    borderWidth: 1,
    borderColor: 'rgba(211, 140, 157, 0.1)', // Subtle brand pink border
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C35', // Heading Mauve
    marginBottom: 0,
    fontFamily: 'Outfit-Bold',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D38C9D', // Antique Rose
    marginBottom: 2,
    fontFamily: 'Outfit-Regular',
  },
  foodDescription: {
    fontSize: 11,
    color: '#7A5560', // Body Mauve
    lineHeight: 15,
    fontFamily: 'Outfit-Regular',
  },
  descriptionArea: {
    height: 28,
    justifyContent: 'flex-start',
  },
  foodBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  addIconButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#D38C9D', // Antique Rose
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
    shadowColor: '#D38C9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 5,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});

export default FoodCard;

