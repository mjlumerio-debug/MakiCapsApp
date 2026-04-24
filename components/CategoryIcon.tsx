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

  return <Feather name="tag" size={18} color={isActive ? "#C87D87" : "#7A5560"} />;
});

const styles = StyleSheet.create({
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
});

export default CategoryIcon;
