import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { resolveGoogleSmartLocation } from '@/lib/google_location';
import { upsertAutoDetectedAddress, resolveAndSetBestActiveAddress, type Address } from '@/lib/ui_store';

type LocationParams = {
  addresses: Address[];
  activeAddressId: string | null;
};

export function useLocationDetection() {
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);

  const detectLocation = useCallback(async (params: LocationParams) => {
    setIsLoadingGPS(true);
    try {
      const { addresses, activeAddressId } = params;
      const activeAddress = addresses.find((address) => address.id === activeAddressId) ?? null;
      const coords: { lat: number; lng: number } = { lat: 0, lng: 0 };
      
      const hasActiveAddressCoords =
        Number.isFinite(Number(activeAddress?.latitude)) &&
        Number.isFinite(Number(activeAddress?.longitude));

      if (hasActiveAddressCoords) {
        coords.lat = Number(activeAddress?.latitude);
        coords.lng = Number(activeAddress?.longitude);
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          console.log('Location permission denied');
          setIsLoadingGPS(false);
          return null;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords.lat = location.coords.latitude;
        coords.lng = location.coords.longitude;

        // Reverse geocode to get a readable address
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: coords.lat,
          longitude: coords.lng,
        });
        
        const firstAddress = geocoded[0];
        let street = firstAddress?.street || firstAddress?.name || firstAddress?.district || 'Current Location';
        const city = firstAddress?.city || firstAddress?.subregion || '';
        const province = firstAddress?.subregion || firstAddress?.region || firstAddress?.country || '';
        const barangay = firstAddress?.district || '';
        let subdivision = firstAddress?.name || '';
        let resolvedCity = city;
        let resolvedProvince = province;
        let fullAddress = [street, city, province].filter(Boolean).join(', ') || 'Current Location';

        try {
          const smart = await resolveGoogleSmartLocation(
            coords.lat,
            coords.lng,
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
          );
          const landmarkName = String(smart.landmark || '').trim();
          const smartBarangay = String(smart.barangay || barangay || '').trim();
          const smartCity = String(smart.city || city || '').trim();
          const smartProvince = String(smart.province || province || '').trim();
          resolvedCity = smartCity || city;
          resolvedProvince = smartProvince || province;
          
          const normalizePart = (value: string) =>
            String(value || '')
              .toLowerCase()
              .replace(/barangay|brgy|\.?\s+|[^a-z0-9]/gi, '')
              .trim();
              
          const areaLabel = [smartBarangay, resolvedCity, resolvedProvince].filter(Boolean).join(', ');
          const cityProvinceLabel = [resolvedCity, resolvedProvince].filter(Boolean).join(', ');
          const landmarkLooksGenericArea =
            !!landmarkName &&
            (
              normalizePart(landmarkName) === normalizePart(areaLabel) ||
              normalizePart(landmarkName) === normalizePart(cityProvinceLabel)
            );

          if (landmarkName && !/\+/.test(landmarkName) && !landmarkLooksGenericArea) {
            subdivision = landmarkName;
            if (!street || /current location/i.test(street) || /\+/.test(street)) {
              street = landmarkName;
            }
            fullAddress = [landmarkName, [smartBarangay, resolvedCity, resolvedProvince].filter(Boolean).join(', ')]
              .filter(Boolean)
              .join('\n');
          } else if (smart.smartAddress) {
            fullAddress = smart.smartAddress;
          } else {
            fullAddress = [street, resolvedCity, resolvedProvince].filter(Boolean).join(', ');
          }
        } catch {
          const labelParts = [barangay, resolvedCity, resolvedProvince].filter(Boolean);
          fullAddress = [street, ...labelParts].filter(Boolean).join(', ');
        }

        upsertAutoDetectedAddress({
          latitude: coords.lat,
          longitude: coords.lng,
          street,
          barangay,
          subdivision,
          city: resolvedCity,
          province: resolvedProvince,
          fullAddress,
        });
        
        resolveAndSetBestActiveAddress({
          latitude: coords.lat,
          longitude: coords.lng,
        });
      }
      
      return coords;
    } catch (error) {
      console.error('[useLocationDetection] Error:', error);
      return null;
    } finally {
      setIsLoadingGPS(false);
    }
  }, []);

  return { detectLocation, isLoadingGPS };
}
