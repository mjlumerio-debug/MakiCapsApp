import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type LocationCardProps = {
  landmark: string;
  address: string;
  distanceText?: string;
  buttonText?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

const clean = (value: string): string =>
  String(value || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\b(brgy\s*rd|barangay\s*road)\b/gi, '')
    .trim()
    .replace(/^,\s*|\s*,$/g, '');

export default function LocationCard({
  landmark,
  address,
  distanceText,
  buttonText = 'Select Address',
  selected = false,
  disabled = false,
  onPress,
}: LocationCardProps) {
  const safeLandmark = clean(landmark) || 'Pinned Location';
  const safeAddress = clean(address);
  const safeDistance = clean(distanceText || '');

  return (
    <View style={styles.card}>
      {selected ? (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>Selected</Text>
        </View>
      ) : null}

      <View style={styles.topRow}>
        <Ionicons name="location-outline" size={18} color="#D7263D" style={styles.topIcon} />
        <Text style={styles.landmarkText} numberOfLines={2}>
          {safeLandmark}
        </Text>
      </View>

      {!!safeAddress && (
        <Text style={styles.addressText} numberOfLines={2}>
          {safeAddress}
        </Text>
      )}

      {!!safeDistance && (
        <Text style={styles.distanceText} numberOfLines={1}>
          {safeDistance}
        </Text>
      )}

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
      >
        <Ionicons name="map-outline" size={16} color="#FFFFFF" />
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: '#FFD8BF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D96A2A',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  topIcon: {
    marginTop: 1,
    marginRight: 8,
  },
  landmarkText: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '700',
    color: '#222222',
    lineHeight: 24,
    paddingRight: 70,
  },
  addressText: {
    marginTop: 4,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  distanceText: {
    marginTop: 6,
    fontSize: 12,
    color: '#999999',
  },
  divider: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  button: {
    marginTop: 12,
    backgroundColor: '#FF6B00',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

