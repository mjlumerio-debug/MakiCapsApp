import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { type Category } from '@/lib/menu_store';

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
      />
    );
  }

  return <Feather name="tag" size={14} color={isActive ? "#D94F3D" : "#8A8A8A"} />;
});

const styles = StyleSheet.create({
  categoryImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});

export default CategoryIcon;
