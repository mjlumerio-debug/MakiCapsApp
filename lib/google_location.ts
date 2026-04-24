import axios from 'axios';

export type GoogleSmartLocation = {
  landmark: string | null;
  barangay: string;
  city: string;
  province: string;
  rawAddress: string;
  smartAddress: string;
};

const clean = (value: string | null | undefined): string =>
  String(value || '')
    .trim()
    .replace(/\s{2,}/g, ' ');

const normalize = (value: string): string =>
  clean(value)
    .toLowerCase()
    .replace(/barangay|brgy|\.?\s+|[^a-z0-9]/gi, '')
    .trim();

const uniqueParts = (parts: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];

  parts.forEach((part) => {
    const value = clean(part);
    if (!value) return;
    const key = normalize(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });

  return out;
};

const pickFromComponents = (
  components: any[],
  typePriority: string[][]
): string => {
  for (const typesToMatch of typePriority) {
    const found = components.find((component) => {
      const types: string[] = Array.isArray(component?.types) ? component.types : [];
      return typesToMatch.every((type) => types.includes(type));
    });
    const name = clean(found?.long_name || found?.short_name || '');
    if (name) return name;
  }
  return '';
};

const buildSmartAddress = (
  landmark: string | null,
  barangay: string,
  city: string,
  province: string,
  rawAddress: string,
  latitude: number,
  longitude: number
): string => {
  const area = uniqueParts([barangay, city, province]).join(', ');
  const cityProvince = uniqueParts([city, province]).join(', ');
  const cleanLandmark = clean(landmark || '');

  if (cleanLandmark && area) {
    return uniqueParts([cleanLandmark, area]).join(', ');
  }
  if (area) return area;
  if (cityProvince) return cityProvince;
  if (clean(rawAddress)) return clean(rawAddress);
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

const isGenericPlaceName = (name: string): boolean => {
  const value = clean(name).toLowerCase();
  if (!value) return true;
  return /\b(home|house|residence|compound|apartment|building|lot)\b/.test(value);
};

const allowedTypes = new Set([
  'point_of_interest',
  'establishment',
  'church',
  'place_of_worship',
  'store',
  'restaurant',
  'school',
]);

const typePriority = new Map<string, number>([
  ['church', 0],
  ['place_of_worship', 0],
  ['school', 1],
  ['restaurant', 2],
  ['store', 3],
  ['point_of_interest', 4],
  ['establishment', 5],
]);

const toRad = (value: number): number => (value * Math.PI) / 180;

export const getDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const hasAllowedType = (types: string[]): boolean =>
  (types || []).some((type) => allowedTypes.has(String(type).toLowerCase()));

const getPriorityValue = (types: string[]): number => {
  let best = Number.POSITIVE_INFINITY;
  (types || []).forEach((type) => {
    const normalized = String(type).toLowerCase();
    const priority = typePriority.get(normalized);
    if (typeof priority === 'number') {
      best = Math.min(best, priority);
    }
  });
  return Number.isFinite(best) ? best : 999;
};

export const getNearbyLandmark = async (
  lat: number,
  lng: number,
  apiKey: string
): Promise<string | null> => {
  if (!clean(apiKey)) return null;

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&rankby=distance` +
      `&key=${apiKey}`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: { Accept: 'application/json' },
    });

    const results: any[] = Array.isArray(response?.data?.results) ? response.data.results : [];
    const ranked = results
      .map((item) => {
        const name = clean(item?.name || '');
        const types: string[] = Array.isArray(item?.types) ? item.types : [];
        const location = item?.geometry?.location || {};
        const itemLat = Number(location?.lat);
        const itemLng = Number(location?.lng);
        const hasCoord = Number.isFinite(itemLat) && Number.isFinite(itemLng) && hasAllowedType(types);
        if (!hasCoord || !name || isGenericPlaceName(name)) {
          return null;
        }
        const distanceKm = getDistanceKm(lat, lng, itemLat, itemLng);
        const priority = getPriorityValue(types);
        return {
          name,
          distanceKm,
          score: distanceKm + priority * 0.001,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.score - b.score);

    const best = ranked[0];
    return best?.name ? clean(best.name as string) : null;
  } catch {
    return null;
  }
};

export const resolveGoogleSmartLocation = async (
  lat: number,
  lng: number,
  apiKey: string
): Promise<GoogleSmartLocation> => {
  const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  if (!clean(apiKey)) {
    return {
      landmark: null,
      barangay: '',
      city: '',
      province: '',
      rawAddress: fallback,
      smartAddress: fallback,
    };
  }

  let rawAddress = '';
  let barangay = '';
  let city = '';
  let province = '';
  let geocodeLandmark: string | null = null;

  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const geocodeResponse = await axios.get(geocodeUrl, {
      timeout: 10000,
      headers: { Accept: 'application/json' },
    });

    const results: any[] = Array.isArray(geocodeResponse?.data?.results) ? geocodeResponse.data.results : [];
    rawAddress = clean(results[0]?.formatted_address || '');
    const components = results.flatMap((result) =>
      Array.isArray(result?.address_components) ? result.address_components : []
    );

    barangay = pickFromComponents(components, [
      ['sublocality_level_1'],
      ['sublocality'],
      ['neighborhood'],
    ]);
    city = pickFromComponents(components, [
      ['locality'],
      ['postal_town'],
      ['administrative_area_level_3'],
    ]);
    province = pickFromComponents(components, [
      ['administrative_area_level_2'],
      ['administrative_area_level_1'],
    ]);
    geocodeLandmark = pickFromComponents(components, [
      ['point_of_interest'],
      ['establishment'],
      ['premise'],
    ]) || null;
  } catch {
    // Keep fallback values
  }

  const nearbyLandmark = await getNearbyLandmark(lat, lng, apiKey);
  const landmark = nearbyLandmark || geocodeLandmark || null;
  const smartAddress = buildSmartAddress(
    landmark,
    barangay,
    city,
    province,
    rawAddress,
    lat,
    lng
  );

  return {
    landmark,
    barangay,
    city,
    province,
    rawAddress: clean(rawAddress) || fallback,
    smartAddress,
  };
};

export const searchPlaces = async (query: string, apiKey: string) => {
  if (!query || !apiKey) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query
    )}&key=${apiKey}&components=country:ph`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data.predictions || [];
  } catch (error) {
    console.error('[GoogleLocation] searchPlaces error:', error);
    return [];
  }
};

export const getPlaceDetails = async (placeId: string, apiKey: string) => {
  if (!placeId || !apiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data.result || null;
  } catch (error) {
    console.error('[GoogleLocation] getPlaceDetails error:', error);
    return null;
  }
};
