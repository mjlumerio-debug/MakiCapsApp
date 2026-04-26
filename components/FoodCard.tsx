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
    borderRadius: 24,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  foodCardBody: {
    padding: 14,
    paddingTop: 10,
  },
  foodImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
    fontFamily: 'Outfit-Bold',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: 'Outfit-Bold',
  },
  foodDescription: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Outfit-Regular',
  },
  descriptionArea: {
    height: 48,
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  foodBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  addIconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addIconButtonDisabled: {
    backgroundColor: '#E5E7EB',
    elevation: 0,
    shadowOpacity: 0,
  },
  viewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heartButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 5,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default FoodCard;

