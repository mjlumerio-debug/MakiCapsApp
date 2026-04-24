import { Feather, FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type Food } from '@/lib/menu_store';

type FoodCardProps = {
  item: Food;
  width: number;
  isFavorite: boolean;
  onToggleFavorite: (foodId: string) => void;
  onAddToCart: (item: Food) => void;
  onPress: (item: Food) => void;
  isOpen: boolean;
};

const FoodCard = memo(function FoodCard({
  item,
  width,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onPress,
  isOpen,
}: FoodCardProps) {
  const stockCount = Number(item.stock ?? 0);
  const isAvailableAtBranch = item.is_available;
  const isAvailable = isOpen && stockCount > 0 && isAvailableAtBranch;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.foodCard, { width }]}
      onPress={() => onPress(item)}
    >
      <View style={[styles.foodCardBody, !isAvailable && { opacity: 0.7 }]}>
        <View style={[styles.foodImageWrap, !item.image && { backgroundColor: '#F3ECE0', justifyContent: 'center', alignItems: 'center' }]}>
          {item.image ? (
            <Image
              source={item.image as any}
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
        
        {!isAvailable ? (
          <Text style={[styles.stockText, styles.stockTextUnavailable]}>
            {!isAvailableAtBranch ? 'Unavailable at branch' : (!isOpen ? 'Branch Closed' : 'Out of Stock')}
          </Text>
        ) : null}

        <View style={styles.foodBottomRow}>
          <TouchableOpacity
            activeOpacity={isAvailable ? 0.8 : 1}
            style={[styles.addIconButton, !isAvailable && styles.addIconButtonDisabled]}
            onPress={() => isAvailable ? onAddToCart(item) : null}
            disabled={!isAvailable}
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
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  foodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  foodCardBody: {
    padding: 12,
  },
  foodImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
    fontFamily: 'Outfit_700Bold',
  },
  priceBelowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D94F3D',
    marginBottom: 6,
    fontFamily: 'Outfit_600SemiBold',
  },
  foodDescription: {
    fontSize: 11,
    color: '#8A8A8A',
    lineHeight: 15,
    marginBottom: 8,
    fontFamily: 'Outfit_400Regular',
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
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addIconButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  heartButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  stockTextUnavailable: {
    color: '#D94F3D',
  },
});

export default FoodCard;
