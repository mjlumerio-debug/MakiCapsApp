import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

type Coordinates = { lat: number; lng: number };

type SmartLocationState = {
  coordinates: Coordinates;
  smartAddress: string;
  rawAddress: string;
  landmark: string | null;
  loading: boolean;
  error: string | null;
};

type GeocodeExtract = {
  rawAddress: string;
  barangay: string;
  city: string;
  province: string;
  geocodeLandmark: string | null;
};

type NearbyPlace = {
  name: string;
  lat: number;
  lng: number;
  types: string[];
};

type LocationCache = SmartLocationState & {
  timestamp: number;
};

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const CACHE_KEY = 'smart_location_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_REVERSE_DISTANCE_METERS = 25;
const MIN_REVERSE_INTERVAL_MS = 30 * 1000;
const DEBOUNCE_MS = 900;

const INITIAL_STATE: SmartLocationState = {
  coordinates: { lat: 0, lng: 0 },
  smartAddress: '',
  rawAddress: '',
  landmark: null,
  loading: true,
  error: null,
};

const cleanPart = (value: string | null | undefined): string =>
  String(value || '')
    .trim()
    .replace(/\s{2,}/g, ' ');

const normalizePart = (value: string): string =>
  cleanPart(value)
    .toLowerCase()
    .replace(/barangay|brgy|\.?\s+|[^a-z0-9]/gi, '')
    .trim();

const dedupeParts = (parts: string[]): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  parts.forEach((part) => {
    const value = cleanPart(part);
    if (!value) return;
    const key = normalizePart(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });

  return result;
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

const distanceMeters = (a: Coordinates, b: Coordinates): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return 6371000 * c;
};

const formatSmartAddress = (
  landmark: string | null,
  barangay: string,
  city: string,
  province: string,
  rawAddress: string,
  coordinates: Coordinates
): string => {
  const area = dedupeParts([barangay, city, province]).join(', ');
  const cityProvince = dedupeParts([city, province]).join(', ');
  const lm = cleanPart(landmark || '');

  if (lm && area) {
    return dedupeParts([lm, area]).join(', ');
  }
  if (area) return area;
  if (cityProvince) return cityProvince;
  if (cleanPart(rawAddress)) return cleanPart(rawAddress);
  return `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
};

const pickComponent = (
  components: any[],
  typeGroups: string[][]
): string => {
  for (const group of typeGroups) {
    for (const comp of components) {
      const types: string[] = Array.isArray(comp?.types) ? comp.types : [];
      const hasAll = group.every((t) => types.includes(t));
      if (hasAll) {
        const value = cleanPart(comp?.long_name || comp?.short_name || '');
        if (value) return value;
      }
    }
  }
  return '';
};

const extractFromGeocodeResult = (data: any): GeocodeExtract => {
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const rawAddress = cleanPart(results[0]?.formatted_address || '');
  const components = results.flatMap((r: any) =>
    Array.isArray(r?.address_components) ? r.address_components : []
  );

  const barangay = pickComponent(components, [
    ['sublocality_level_1'],
    ['sublocality'],
    ['neighborhood'],
  ]);

  const city = pickComponent(components, [
    ['locality'],
    ['postal_town'],
    ['administrative_area_level_3'],
  ]);

  const province = pickComponent(components, [
    ['administrative_area_level_2'],
    ['administrative_area_level_1'],
  ]);

  const geocodeLandmark = pickComponent(components, [
    ['point_of_interest'],
    ['establishment'],
    ['premise'],
  ]);

  return {
    rawAddress,
    barangay,
    city,
    province,
    geocodeLandmark: geocodeLandmark || null,
  };
};

const isMeaningfulLandmark = (name: string, city: string, province: string): boolean => {
  const candidate = cleanPart(name);
  if (!candidate) return false;
  if (candidate.length < 3) return false;
  if (/^[\d\s.,-]+$/.test(candidate)) return false;

  const normalized = normalizePart(candidate);
  if (!normalized) return false;

  const cityNorm = normalizePart(city);
  const provinceNorm = normalizePart(province);
  if (normalized === cityNorm || normalized === provinceNorm) return false;

  return true;
};

const placeTypeScore = (types: string[]): number => {
  const set = new Set(types || []);
  if (set.has('church')) return 120;
  if (set.has('school')) return 110;
  if (set.has('restaurant')) return 100;
  if (set.has('store')) return 95;
  if (set.has('point_of_interest')) return 90;
  if (set.has('establishment')) return 80;
  return 0;
};

const pickNearestLandmark = (
  places: NearbyPlace[],
  center: Coordinates,
  city: string,
  province: string
): string | null => {
  const best = places
    .filter((p) => isMeaningfulLandmark(p.name, city, province))
    .map((p) => ({
      name: p.name,
      score: placeTypeScore(p.types) - Math.min(60, distanceMeters(center, { lat: p.lat, lng: p.lng }) / 4),
    }))
    .sort((a, b) => b.score - a.score)[0];

  return best?.name ? cleanPart(best.name) : null;
};

const parseNearbyPlaces = (data: any): NearbyPlace[] => {
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  return results
    .map((p) => ({
      name: cleanPart(p?.name || ''),
      lat: Number(p?.geometry?.location?.lat),
      lng: Number(p?.geometry?.location?.lng),
      types: Array.isArray(p?.types) ? p.types : [],
    }))
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
};

const buildNearbyUrl = (coords: Coordinates): string => {
  const keyword = encodeURIComponent('establishment|point_of_interest|church|school|restaurant|store');
  return `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coords.lat},${coords.lng}&radius=100&type=point_of_interest&keyword=${keyword}&key=${GOOGLE_MAPS_API_KEY}`;
};

const readCache = async (): Promise<LocationCache | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationCache;
    if (!parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = async (state: SmartLocationState): Promise<void> => {
  try {
    const payload: LocationCache = { ...state, timestamp: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};

export const useSmartLocation = (): SmartLocationState => {
  const [state, setState] = useState<SmartLocationState>(INITIAL_STATE);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResolvedRef = useRef<{ at: number; coords: Coordinates } | null>(null);
  const mountedRef = useRef(true);

  const updateState = useCallback((next: Partial<SmartLocationState>) => {
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const shouldSkipResolve = useCallback((coords: Coordinates): boolean => {
    const last = lastResolvedRef.current;
    if (!last) return false;
    const elapsed = Date.now() - last.at;
    if (elapsed > MIN_REVERSE_INTERVAL_MS) return false;
    const moved = distanceMeters(last.coords, coords);
    return moved < MIN_REVERSE_DISTANCE_METERS;
  }, []);

  const resolveSmartAddress = useCallback(
    async (coords: Coordinates) => {
      if (shouldSkipResolve(coords)) return;

      if (!GOOGLE_MAPS_API_KEY) {
        const fallback = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
        const nextState: SmartLocationState = {
          coordinates: coords,
          smartAddress: fallback,
          rawAddress: fallback,
          landmark: null,
          loading: false,
          error: 'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
        };
        lastResolvedRef.current = { at: Date.now(), coords };
        updateState(nextState);
        await writeCache(nextState);
        return;
      }

      updateState({ loading: true, error: null, coordinates: coords });

      let geocode: GeocodeExtract = {
        rawAddress: '',
        barangay: '',
        city: '',
        province: '',
        geocodeLandmark: null,
      };
      let nearbyLandmark: string | null = null;

      try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${GOOGLE_MAPS_API_KEY}`;
        const geocodeRes = await fetch(geocodeUrl);
        if (geocodeRes.ok) {
          const geocodeJson = await geocodeRes.json();
          geocode = extractFromGeocodeResult(geocodeJson);
        }
      } catch {
        // Geocode fallback handled below
      }

      try {
        const placesRes = await fetch(buildNearbyUrl(coords));
        if (placesRes.ok) {
          const placesJson = await placesRes.json();
          const places = parseNearbyPlaces(placesJson);
          nearbyLandmark = pickNearestLandmark(places, coords, geocode.city, geocode.province);
        }
      } catch {
        // Places fallback handled below
      }

      const landmark = nearbyLandmark || geocode.geocodeLandmark;
      const smartAddress = formatSmartAddress(
        landmark,
        geocode.barangay,
        geocode.city,
        geocode.province,
        geocode.rawAddress,
        coords
      );

      const rawAddress =
        cleanPart(geocode.rawAddress) ||
        dedupeParts([geocode.city, geocode.province]).join(', ') ||
        `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

      const nextState: SmartLocationState = {
        coordinates: coords,
        smartAddress,
        rawAddress,
        landmark: landmark || null,
        loading: false,
        error: null,
      };

      lastResolvedRef.current = { at: Date.now(), coords };
      updateState(nextState);
      await writeCache(nextState);
    },
    [shouldSkipResolve, updateState]
  );

  const queueResolve = useCallback(
    (coords: Coordinates) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        resolveSmartAddress(coords).catch((err) => {
          updateState({
            loading: false,
            coordinates: coords,
            error: cleanPart(err?.message || 'Failed to detect location'),
            smartAddress:
              `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
            rawAddress:
              `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
          });
        });
      }, DEBOUNCE_MS);
    },
    [resolveSmartAddress, updateState]
  );

  useEffect(() => {
    mountedRef.current = true;

    const bootstrap = async () => {
      updateState({ loading: true, error: null });

      const cache = await readCache();
      if (cache) {
        lastResolvedRef.current = {
          at: cache.timestamp,
          coords: cache.coordinates,
        };
        updateState({
          coordinates: cache.coordinates,
          smartAddress: cache.smartAddress,
          rawAddress: cache.rawAddress,
          landmark: cache.landmark,
          loading: false,
          error: null,
        });
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        updateState({
          loading: false,
          error: 'Location permission denied',
        });
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      queueResolve({
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      });

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 15,
          timeInterval: 10000,
          mayShowUserSettingsDialog: true,
        },
        (pos) => {
          queueResolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }
      );
    };

    bootstrap().catch((err) => {
      updateState({
        loading: false,
        error: cleanPart(err?.message || 'Unable to initialize smart location'),
      });
    });

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [queueResolve, updateState]);

  return state;
};
