import { Feather, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Keyboard,
} from 'react-native';
import RNMapView, { type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LocationCard from '../components/LocationCard';
import MakiModal from '../components/MakiModal';
import { MapView } from '../components/MapComponent';
import { getNearbyLandmark } from '../lib/google_location';
import { addAddress, updateAddress, useUiStore } from '../lib/ui_store';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '@/constants/theme';

// Geocoding Helpers (Module Level for scope stability)
const normalize = (s: string) => s.toLowerCase().replace(/barangay|brgy|\.?\s+|[^a-z0-9]/gi, '').trim();
const isSubdivKeyword = (s: string) => /village|subdivision|subd|estate|heights|building|tower|condo|apartment|residences/i.test(s);
const isStreetKeyword = (s: string) => /\b(street|st|rd|road|ave|avenue|highway|hway|blvd|boulevard|lane|ln)\b/i.test(s);
const clean = (s: string) => (s || '').trim();
const containsAreaToken = (source: string, token: string): boolean => {
    const sourceNorm = normalize(source);
    const tokenNorm = normalize(token);
    if (!sourceNorm || !tokenNorm) return false;
    if (sourceNorm === tokenNorm) return true;
    return tokenNorm.length >= 5 && sourceNorm.includes(tokenNorm);
};
const uniqueNonEmpty = (parts: string[]) => {
    const result: string[] = [];
    const seen = new Set<string>();

    parts.forEach((part) => {
        const cleaned = clean(part)
            .replace(/\s*,\s*/g, ', ')
            .replace(/,{2,}/g, ',')
            .replace(/^,\s*|\s*,$/g, '');
        if (!cleaned) return;

        const key = normalize(cleaned);
        if (!key || seen.has(key)) return;

        const covered = result.some((existing) => containsAreaToken(existing, cleaned));
        if (covered) return;

        seen.add(key);
        result.push(cleaned);
    });

    return result;
};
const REGION_LIKE_REGEX = /\b(calabarzon|mimaropa|western visayas|central visayas|eastern visayas|ncr|metro manila|region\s*[ivx0-9]+)\b/i;
const pickSpecificProvince = (preferred: string, fallback: string): string => {
    const p = sanitizeAddressPart(preferred || '');
    const f = sanitizeAddressPart(fallback || '');
    if (!p) return f;
    if (!f) return p;
    if (normalize(p) === normalize(f)) return p;
    if (REGION_LIKE_REGEX.test(p) && !REGION_LIKE_REGEX.test(f)) return f;
    return p;
};
const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
const PLUS_CODE_REGEX = /\b[A-Z0-9]{2,8}\+[A-Z0-9]{2,}\b/i;
const MIN_STREET_LENGTH = 5;

const stripPlusCode = (value: string): string =>
    clean(value).replace(PLUS_CODE_REGEX, '').replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim();

const isUnclearAddress = (street: string, formattedAddress: string): boolean => {
    const normalizedStreet = clean(street);
    const normalizedFormatted = clean(formattedAddress);

    return (
        !normalizedStreet ||
        normalizedStreet.length < MIN_STREET_LENGTH ||
        normalizedStreet.includes('+') ||
        PLUS_CODE_REGEX.test(normalizedStreet) ||
        PLUS_CODE_REGEX.test(normalizedFormatted)
    );
};

const buildHumanAddress = (street: string, city: string): string =>
    uniqueNonEmpty([stripPlusCode(street), stripPlusCode(city)]).join(', ');

const sanitizeAddressPart = (value: string): string => {
    const cleaned = stripPlusCode(value);
    if (!cleaned) return '';
    if (PLUS_CODE_REGEX.test(cleaned)) return '';
    return cleaned;
};

const formatDeliveryAddress = (
    geo: { barangay?: string; city?: string; municipality?: string; province?: string },
    establishmentName?: string
): string => {
    const line1 = sanitizeAddressPart(establishmentName || '');
    const line2Parts = uniqueNonEmpty([
        sanitizeAddressPart(geo.barangay || ''),
        sanitizeAddressPart(geo.city || geo.municipality || ''),
        sanitizeAddressPart(geo.province || ''),
    ]);
    const line2 = line2Parts.join(', ');

    if (line1 && line2 && containsAreaToken(line1, line2)) {
        return line1;
    }

    if (line1 && line2) {
        return `${line1}\n${line2}`;
    }
    return line1 || line2;
};

export default function NewAddressScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const { addresses } = useUiStore();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useAppTheme();
    const mapRef = useRef<RNMapView>(null);
    const isEditing = !!params.id;

    // Initial region (Manila loosely)
    const initialRegion = {
        latitude: 14.5995,
        longitude: 120.9842,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };

    const [markerCoord, setMarkerCoord] = useState({ latitude: 14.5995, longitude: 120.9842 });
    const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [isFetchingAddress, setIsFetchingAddress] = useState(false);
    const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
    const [showSavedModal, setShowSavedModal] = useState(false);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // Form fields
    const [barangay, setBarangay] = useState('');
    const [street, setStreet] = useState('');
    const [subdivision, setSubdivision] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');
    const [fullAddress, setFullAddress] = useState('');
    const [selectedPinAddress, setSelectedPinAddress] = useState('');
    const [isFallbackLabel, setIsFallbackLabel] = useState(false);

    // Search features
    const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef<any>(null);
    const geocodeTimeout = useRef<any>(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        // Live search debouncing
        if (searchQuery.trim().length > 1 && isSearchModalVisible) {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            searchTimeout.current = setTimeout(() => {
                searchLocation();
            }, 400);
        }
        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [searchQuery]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        return () => {
            if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
        };
    }, []);

    useEffect(() => {
        if (isFallbackLabel) {
            return;
        }
        const parts = [subdivision, street, barangay, city, province]
            .map((part) => sanitizeAddressPart(part))
            .filter((part) => !!part);
        if (parts.length > 0) {
            const composed = parts.join(', ');
            setFullAddress((prev) => {
                if (isFallbackLabel && clean(prev).length > clean(composed).length) {
                    return prev;
                }
                return composed;
            });
        } else if (!isFetchingAddress && !isEditing) {
            setFullAddress('');
        }
    }, [subdivision, street, barangay, city, province, isFallbackLabel, isFetchingAddress, isEditing]);

    const hasLoadedRef = useRef(false);

    useEffect(() => {
        if (isEditing && addresses && !hasLoadedRef.current) {
            const addr = addresses.find(a => a.id === params.id);
            if (addr) {
                setStreet(addr.street || '');
                setBarangay(addr.barangay || '');
                setSubdivision(addr.subdivision || '');
                setCity(addr.city || '');
                setProvince(addr.province || '');
                setFullAddress(addr.fullAddress);
                const lat = addr.latitude || 14.5995;
                const lon = addr.longitude || 120.9842;
                const coord = { latitude: lat, longitude: lon };

                setMarkerCoord(coord);
                setTimeout(() => {
                    mapRef.current?.animateToRegion({
                        ...coord,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    }, 1000);
                }, 500);

                hasLoadedRef.current = true;
            }
        } else if (!isEditing && !hasLoadedRef.current) {
            getCurrentLocation();
            hasLoadedRef.current = true;
        }
    }, [params.id, addresses, isEditing]);

    const getCurrentLocation = async () => {
        setIsLoadingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Allow location access to pin your address.', [{ text: 'OK' }]);
                setIsLoadingLocation(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
            });

            const newCoord = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            setUserCoord(newCoord);
            setMarkerCoord(newCoord);
            mapRef.current?.animateToRegion({
                ...newCoord,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 1000);

            await reverseGeocode(newCoord.latitude, newCoord.longitude);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not fetch current location.');
        } finally {
            setIsLoadingLocation(false);
        }
    };

    const fetchGooglePlaceDetails = async (placeId: string) => {
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return null;
        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,formatted_address&key=${apiKey}`);
            const data = await response.json();
            if (data.status === 'OK') {
                const comps = data.result.address_components;
                let fBarangay = '';
                let fStreet = '';
                let fSubdiv = '';
                let fCity = '';
                let fProvince = '';

                comps.forEach((c: any) => {
                    const t = c.types;
                    const n = c.long_name;
                    if (t.includes('sublocality') || t.includes('sublocality_level_1')) fBarangay = n;
                    if (t.includes('route')) fStreet = n;
                    if (t.includes('locality')) fCity = n;
                    if (t.includes('administrative_area_level_2')) fProvince = n;
                    if (t.includes('neighborhood') || t.includes('premise') || t.includes('subpremise') || t.includes('point_of_interest') || t.includes('establishment')) {
                        if (isStreetKeyword(n)) { if (!fStreet) fStreet = n; }
                        else if (isSubdivKeyword(n)) fSubdiv = n;
                    }
                });
                return { street: fStreet, barangay: fBarangay, subdivision: fSubdiv, city: fCity, province: fProvince, formatted: data.result.formatted_address };
            }
        } catch (e) { console.log("Place Details Error:", e); }
        return null;
    };

    const fetchNearbyEstablishment = async (latitude: number, longitude: number) => {
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return '';
        try {
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=500&type=establishment&key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) return '';
            const data = await response.json();
            if (data.status !== 'OK' || !data.results?.length) return '';

            const nearest = data.results
                .map((place: any) => {
                    const loc = place?.geometry?.location;
                    const name = sanitizeAddressPart(place?.name || '');
                    if (!loc?.lat || !loc?.lng || !name || isStreetKeyword(name)) {
                        return null;
                    }
                    const meters = distanceMeters(latitude, longitude, loc.lat, loc.lng);
                    return { name, meters };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => a.meters - b.meters)[0];

            if (nearest?.name) {
                return nearest.name;
            }

            const firstWithin100m = data.results.find((place: any) => {
                const loc = place?.geometry?.location;
                if (!loc?.lat || !loc?.lng) return false;
                const meters = distanceMeters(latitude, longitude, loc.lat, loc.lng);
                const name = sanitizeAddressPart(place?.name || '');
                return meters <= 100 && !!name && !isStreetKeyword(name);
            });

            return sanitizeAddressPart(firstWithin100m?.name || '');
        } catch (error) {
            console.log('Nearby establishment lookup failed:', error);
            return '';
        }
    };

    const fetchNearestEstablishmentFromBackend = async (
        latitude: number,
        longitude: number
    ): Promise<{
        name: string;
        barangay: string;
        municipality: string;
        province: string;
    }> => {
        try {
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
            const nearestName = sanitizeAddressPart(
                (await getNearbyLandmark(latitude, longitude, apiKey)) || ''
            );
            return {
                name: nearestName,
                barangay: '',
                municipality: '',
                province: '',
            };
        } catch {
            return {
                name: '',
                barangay: '',
                municipality: '',
                province: '',
            };
        }
    };

    const reverseGeocode = async (latitude: number, longitude: number, passedName?: string, deepDetails?: any) => {
        setIsFetchingAddress(true);
        let masterStreet = '';
        let masterBarangay = '';
        let masterSubdiv = '';
        let masterCity = '';
        let masterProvince = '';
        let masterFullAddress = '';
        let nearbyEstablishment = '';

        try {
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
            if (apiKey) {
                try {
                    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);
                    const data = await response.json();
                    if (data.status === 'OK' && data.results.length > 0) {
                        const result = data.results[0];
                        masterFullAddress = result.formatted_address;

                        result.address_components.forEach((component: any) => {
                            const types = component.types;
                            const name = component.long_name;
                            if (types.includes('sublocality') || types.includes('sublocality_level_1')) masterBarangay = name;
                            if (types.includes('route')) masterStreet = name;
                            if (types.includes('locality')) masterCity = name;
                            if (types.includes('administrative_area_level_2')) masterProvince = name;
                            if (types.includes('administrative_area_level_1') && !masterProvince) masterProvince = name;

                            if (types.includes('neighborhood') || types.includes('premise') || types.includes('subpremise') ||
                                types.includes('point_of_interest') || types.includes('establishment')) {
                                if (isStreetKeyword(name)) {
                                    if (!masterStreet) masterStreet = name;
                                } else if (isSubdivKeyword(name)) {
                                    masterSubdiv = name;
                                }
                            }
                            if (!masterStreet && types.includes('sublocality_level_2') && isStreetKeyword(name)) masterStreet = name;
                        });
                    }
                } catch (gErr) { console.log("Google Layer Failed:", gErr); }
            }

            if (!masterStreet || !masterSubdiv) {
                try {
                    const osmResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
                        headers: { 'User-Agent': 'MakiCapsApp/1.0', 'Accept-Language': 'en' }
                    });
                    if (osmResponse.ok) {
                        const osmData = await osmResponse.json();
                        if (osmData && osmData.address) {
                            const addr = osmData.address;
                            if (!masterStreet) masterStreet = addr.road || addr.pedestrian || (isStreetKeyword(addr.neighbourhood || '') ? addr.neighbourhood : '');
                            if (!masterBarangay) masterBarangay = addr.village || addr.suburb || addr.quarter || addr.hamlet || '';
                            if (!masterCity) masterCity = addr.city || addr.town || addr.municipality || '';
                            if (!masterProvince) masterProvince = addr.county || addr.province || addr.state || '';

                            const osmPOI = addr.neighbourhood || addr.residential || addr.amenity || addr.church || addr.shop || addr.office || addr.allotments || '';
                            if (!masterSubdiv && osmPOI && isSubdivKeyword(osmPOI)) {
                                masterSubdiv = osmPOI;
                            }
                        }
                    }
                } catch (osmErr) { console.log("OSM Layer Failed:", osmErr); }
            }

            if (!masterBarangay || !masterCity) {
                try {
                    const bdcResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                    if (bdcResponse.ok) {
                        const bdcData = await bdcResponse.json();
                        if (bdcData && bdcData.locality) {
                            if (!masterCity) masterCity = bdcData.city || bdcData.locality || '';
                            if (!masterProvince) masterProvince = bdcData.principalSubdivision || bdcData.localityInfo?.administrative?.find((a: any) => a.adminLevel === 4)?.name || '';
                            if (!masterBarangay) masterBarangay = bdcData.localityInfo?.administrative?.find((a: any) => a.adminLevel === 6)?.name || '';

                            const possibleSub = bdcData.localityInfo?.administrative?.find((a: any) => isSubdivKeyword(a.name))?.name;
                            if (!masterSubdiv && possibleSub) masterSubdiv = possibleSub;
                        }
                    }
                } catch (bdcErr) { console.log("BDC Layer Failed:", bdcErr); }
            }

            if (!masterStreet) {
                try {
                    const addressArrs = await Location.reverseGeocodeAsync({ latitude, longitude });
                    if (addressArrs && addressArrs.length > 0) {
                        const addr = addressArrs[0];
                        masterStreet = addr.street || (isStreetKeyword(addr.name || '') ? addr.name : '') || '';
                        if (!masterBarangay) masterBarangay = addr.district || '';
                        if (!masterCity) masterCity = addr.city || '';
                        if (!masterProvince) masterProvince = addr.subregion || addr.region || '';
                        if (!masterSubdiv && addr.name && addr.name !== addr.street && (isSubdivKeyword(addr.name) || isSubdivKeyword(addr.district || ''))) {
                            masterSubdiv = addr.name;
                        }
                    }
                } catch (expoErr) { console.log("Expo Layer Failed:", expoErr); }
            }

            if (deepDetails) {
                if (deepDetails.street) masterStreet = deepDetails.street;
                if (deepDetails.barangay) masterBarangay = deepDetails.barangay;
                if (deepDetails.subdivision) masterSubdiv = deepDetails.subdivision;
                if (deepDetails.city) masterCity = deepDetails.city;
                if (deepDetails.province) masterProvince = deepDetails.province;
                if (deepDetails.formatted) masterFullAddress = deepDetails.formatted;
            } else if (passedName) {
                const pNorm = normalize(passedName);
                if (isSubdivKeyword(passedName)) {
                    masterSubdiv = passedName;
                } else if (isStreetKeyword(passedName)) {
                    masterStreet = passedName;
                    masterSubdiv = '';
                } else {
                    const matchesCity = pNorm === normalize(masterCity);
                    const matchesProvince = pNorm === normalize(masterProvince);
                    if (/barangay|brgy/i.test(passedName) || (!matchesCity && !matchesProvince)) {
                        masterBarangay = passedName.replace(/barangay|brgy|\.?\s+/gi, '').trim();
                    }
                    masterSubdiv = '';
                }
            }

            if (masterSubdiv && !isSubdivKeyword(masterSubdiv) && (normalize(masterSubdiv) === normalize(masterBarangay) || normalize(masterSubdiv) === normalize(masterCity))) {
                masterSubdiv = '';
            }
            if (masterSubdiv && /^[A-Z0-9]{2,8}\+[A-Z0-9]{2}/i.test(masterSubdiv)) masterSubdiv = '';
            if (!isSubdivKeyword(masterSubdiv)) masterSubdiv = '';
            if (masterStreet && !isStreetKeyword(masterStreet)) {
                const streetNorm = normalize(masterStreet);
                if (streetNorm === normalize(masterBarangay) || streetNorm === normalize(masterCity)) {
                    masterStreet = '';
                }
            }

            if (!clean(masterStreet)) {
                nearbyEstablishment = await fetchNearbyEstablishment(latitude, longitude);
                if (!masterSubdiv && nearbyEstablishment) {
                    masterSubdiv = nearbyEstablishment;
                }
            }

            const safeBarangay = sanitizeAddressPart(masterBarangay);
            const safeStreet = sanitizeAddressPart(masterStreet);
            const safeSubdiv = sanitizeAddressPart(masterSubdiv);
            const safeCity = sanitizeAddressPart(masterCity);
            const safeProvince = sanitizeAddressPart(masterProvince);

            setBarangay(safeBarangay);
            setStreet(safeStreet);
            setSubdivision(safeSubdiv);
            setCity(safeCity);
            setProvince(safeProvince);

            const areaOnlyAddress = uniqueNonEmpty([nearbyEstablishment, safeBarangay, safeCity, safeProvince]).join(', ');
            const withStreetAddress = uniqueNonEmpty([safeSubdiv, safeStreet, safeBarangay, safeCity, safeProvince]).join(', ');
            const hasStreet = !!clean(safeStreet);
            const cleanedGoogleFormatted = clean(masterFullAddress);
            const hasPlusCode = /\b[A-Z0-9]{2,8}\+[A-Z0-9]{2,}\b/i.test(cleanedGoogleFormatted);
            const finalAddress = hasStreet
                ? (cleanedGoogleFormatted && !hasPlusCode ? cleanedGoogleFormatted : withStreetAddress)
                : areaOnlyAddress;
            const invalidDisplayAddress = isUnclearAddress(safeStreet, finalAddress || cleanedGoogleFormatted);
            const nearest = await fetchNearestEstablishmentFromBackend(latitude, longitude);
            const selectedPlaceName = sanitizeAddressPart(passedName || '');
            const establishmentCandidate =
                selectedPlaceName ||
                nearest.name ||
                sanitizeAddressPart(nearbyEstablishment) ||
                sanitizeAddressPart(safeSubdiv) ||
                '';
            const geoAreaCandidate = uniqueNonEmpty([safeBarangay, safeCity, safeProvince]).join(', ');
            const preferredEstablishment = containsAreaToken(establishmentCandidate, geoAreaCandidate)
                ? ''
                : establishmentCandidate;

            const geoFromBackend = {
                barangay: safeBarangay || nearest.barangay,
                municipality: safeCity || nearest.municipality,
                province: pickSpecificProvince(nearest.province, safeProvince),
            };

            const formattedTwoLine = formatDeliveryAddress(geoFromBackend, preferredEstablishment);
            const humanAddress = buildHumanAddress(safeStreet, safeCity);
            const displayLabel = stripPlusCode(
                formattedTwoLine ||
                (invalidDisplayAddress
                    ? (areaOnlyAddress || finalAddress)
                    : (humanAddress || finalAddress || withStreetAddress || areaOnlyAddress))
            );

            setIsFallbackLabel(invalidDisplayAddress || !!preferredEstablishment);
            setFullAddress(displayLabel || withStreetAddress || areaOnlyAddress);

        } catch (error) {
            console.error('Final Aggregation Geocoding error:', error);
        } finally {
            setIsFetchingAddress(false);
        }
    };

    const onRegionChangeComplete = (nextRegion: Region) => {
        const { latitude, longitude } = nextRegion;
        setMarkerCoord({ latitude, longitude });

        if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
        geocodeTimeout.current = setTimeout(() => {
            reverseGeocode(latitude, longitude);
        }, 350);
    };

    const searchLocation = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

            if (apiKey) {
                const bias = `circle:20000@${markerCoord.latitude},${markerCoord.longitude}`;
                const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&region=ph&locationbias=${bias}&key=${apiKey}`;

                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'OK') {
                        const formattedResults = data.results.map((place: any) => ({
                            place_id: place.place_id,
                            lat: place.geometry.location.lat,
                            lon: place.geometry.location.lng,
                            name: place.name,
                            display_name: place.formatted_address
                        }));
                        setSearchResults(formattedResults);
                        return;
                    }
                }
            }

            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&lat=${markerCoord.latitude}&lon=${markerCoord.longitude}&limit=15`);
            if (response.ok) {
                const data = await response.json();
                const formattedResults = data.features.map((feature: any, index: number) => {
                    const props = feature.properties;
                    const coords = feature.geometry.coordinates;
                    const streetString = props.street ? props.street : '';
                    const districtString = props.district || props.locality || '';
                    const cityString = props.city || props.county || '';
                    const stateString = props.state || '';
                    const detailsArr = [streetString, districtString, cityString, stateString].filter(Boolean);
                    return {
                        place_id: `${props.osm_id || index}`,
                        lat: coords[1],
                        lon: coords[0],
                        name: props.name || props.street || cityString,
                        display_name: detailsArr.join(', ') || props.country
                    };
                });
                setSearchResults(formattedResults);
            }
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSearchResult = async (placeId: string, latRaw: number | string, lonRaw: number | string, exactName: string, fullDisplayName?: string) => {
        const latitude = typeof latRaw === 'string' ? parseFloat(latRaw) : latRaw;
        const longitude = typeof lonRaw === 'string' ? parseFloat(lonRaw) : lonRaw;

        Keyboard.dismiss();
        setIsSearchModalVisible(false);
        setSearchQuery('');
        setSearchResults([]);

        const newRegion = {
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        };

        setMarkerCoord({ latitude, longitude });
        mapRef.current?.animateToRegion(newRegion, 800);

        if (fullDisplayName) {
            setIsFallbackLabel(false);
            setFullAddress(stripPlusCode(fullDisplayName));
        }

        let deepDetails = null;
        if (placeId && !placeId.includes('osm')) {
            deepDetails = await fetchGooglePlaceDetails(placeId);
        }

        reverseGeocode(latitude, longitude, exactName, deepDetails);
    };

    const handleSelectDeliveryAddress = () => {
        if (!fullAddress || isFetchingAddress) return;
        const stripped = stripPlusCode(fullAddress);
        setSelectedPinAddress(stripped);
        
        // AUTO-TRIGGER DETAILS MODAL for a smoother 1-tap flow
        setTimeout(() => {
            setShowConfirmSaveModal(true);
        }, 100);
    };

    const handleAddDetails = () => {
        if (!selectedPinAddress || isFetchingAddress) {
            Alert.alert('Select location first', 'Tap "Select Delivery Address" to confirm your pinned location.');
            return;
        }
        setShowConfirmSaveModal(true);
    };

    const confirmAddDetails = () => {
        if (!selectedPinAddress || isFetchingAddress) return;

        const addressData = {
            fullAddress: selectedPinAddress,
            street: street || '',
            barangay: barangay || '',
            subdivision: subdivision || '',
            city: city || '',
            province: province || '',
            notes: isFallbackLabel ? 'landmark-fallback' : '',
            latitude: markerCoord.latitude,
            longitude: markerCoord.longitude,
        };

        const isDuplicate = addresses.some(a =>
            a.fullAddress.toLowerCase().replace(/\s+/g, '') === selectedPinAddress.toLowerCase().replace(/\s+/g, '') &&
            (isEditing ? a.id !== params.id : true)
        );

        if (isDuplicate) {
            setShowConfirmSaveModal(false);
            setShowDuplicateModal(true);
            return;
        }

        if (isEditing && params.id) {
            updateAddress(params.id, addressData);
        } else {
            addAddress(addressData);
        }

        setShowConfirmSaveModal(false);
        setShowSavedModal(true);

        // Auto-close and return to previous screen
        setTimeout(() => {
            setShowSavedModal(false);
            setTimeout(() => {
                router.back();
            }, 400);
        }, 1800);
    };

    const pinnedDetailParts = uniqueNonEmpty([subdivision, street, barangay, city, province]);
    const hasSelectedPin = !!selectedPinAddress;
    const livePinLabel = uniqueNonEmpty([barangay, city, province]).join(', ');
    const currentPinLabel = hasSelectedPin ? selectedPinAddress : (fullAddress || 'Move the map pin to detect location');
    const pinLabelLines = currentPinLabel.split('\n').map((line) => line.trim()).filter(Boolean);
    const pinTitle = sanitizeAddressPart(
        pinLabelLines[0]?.split(',')[0] ||
        subdivision ||
        street ||
        'Pinned Location'
    );
    const pinDetailLine = sanitizeAddressPart(
        pinLabelLines[1] ||
        currentPinLabel ||
        livePinLabel ||
        pinnedDetailParts.join(', ')
    );
    const distanceFromUserMeters = userCoord
        ? Math.round(
            distanceMeters(
                markerCoord.latitude,
                markerCoord.longitude,
                userCoord.latitude,
                userCoord.longitude
            )
        )
        : 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={true}
                showsMyLocationButton={false}
                onRegionChangeComplete={onRegionChangeComplete}
            />

            {isLoadingLocation && (
                <View style={[styles.mapLoadingOverlay, { backgroundColor: colors.surface + 'CC' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}

            {/* Back Button Overlay */}
            <TouchableOpacity 
                style={[styles.backOverlayBtn, { backgroundColor: colors.surface }]} 
                onPress={() => router.back()}
            >
                <Feather name="arrow-left" size={24} color={colors.heading} />
            </TouchableOpacity>

            {/* Search Bar Overlay */}
            <TouchableOpacity 
                style={[styles.searchOverlayBtn, { backgroundColor: colors.surface }]}
                onPress={() => setIsSearchModalVisible(true)}
            >
                <Feather name="search" size={20} color={colors.primary} />
                <Text style={[styles.searchPlaceholderText, { color: colors.text }]}>Search for a location...</Text>
            </TouchableOpacity>

            {/* Center Pin Indicator (Visual Only) */}
            <View style={styles.pinIndicatorContainer} pointerEvents="none">
                <View style={[styles.pinIconContainer, { shadowColor: colors.primary }]}>
                    <View style={[styles.pinCircle, { backgroundColor: colors.primary }]}>
                        <Ionicons name="location-sharp" size={24} color="#FFFFFF" />
                    </View>
                    <View style={[styles.pinStick, { backgroundColor: colors.primary }]} />
                </View>
            </View>

            {/* Bottom Panel */}
            <View style={[styles.bottomPanel, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
                <View style={styles.panelHandle} />
                
                <View style={styles.locationHeader}>
                    <View style={[styles.locationIconCircle, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="location" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.locationTitleBox}>
                        <Text style={[styles.locationTitle, { color: colors.heading }]} numberOfLines={1}>
                            {pinTitle}
                        </Text>
                        <Text style={[styles.locationSubtitle, { color: colors.text }]} numberOfLines={2}>
                            {pinDetailLine}
                        </Text>
                    </View>
                </View>

                {distanceFromUserMeters > 0 && (
                    <View style={[styles.distanceBadge, { backgroundColor: colors.surface }]}>
                        <MaterialIcons name="directions-walk" size={12} color={colors.text} />
                        <Text style={[styles.distanceText, { color: colors.text }]}>{distanceFromUserMeters}m from you</Text>
                    </View>
                )}

                <View style={styles.actionRow}>
                    <TouchableOpacity 
                        style={[styles.myLocationBtn, { backgroundColor: colors.surface }]}
                        onPress={getCurrentLocation}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="my-location" size={22} color={colors.primary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.selectBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, (isFetchingAddress || !fullAddress) && { opacity: 0.7 }]}
                        onPress={hasSelectedPin ? handleAddDetails : handleSelectDeliveryAddress}
                        disabled={isFetchingAddress || !fullAddress}
                        activeOpacity={0.85}
                    >
                        {isFetchingAddress ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.selectBtnText}>
                                {hasSelectedPin ? 'Add Delivery Details' : 'Select Delivery Address'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Modal */}
            <Modal
                visible={isSearchModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsSearchModalVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <SafeAreaView style={[styles.searchModalContent, { backgroundColor: colors.background }]}>
                        <View style={[styles.searchHeader, { borderBottomColor: colors.primary + '0A' }]}>
                            <TouchableOpacity onPress={() => setIsSearchModalVisible(false)} style={styles.closeSearchBtn}>
                                <Feather name="chevron-left" size={24} color={colors.heading} />
                            </TouchableOpacity>
                            <View style={[styles.searchInputBox, { backgroundColor: colors.surface }]}>
                                <Feather name="search" size={20} color={colors.primary} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.heading }]}
                                    placeholder="Search location..."
                                    placeholderTextColor={colors.text + '80'}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {isSearching ? (
                            <View style={styles.searchLoading}>
                                <ActivityIndicator color={colors.primary} size="large" />
                            </View>
                        ) : (
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item) => item.place_id}
                                contentContainerStyle={styles.resultsList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={[styles.resultItem, { borderBottomColor: colors.primary + '0A' }]}
                                        onPress={() => handleSelectSearchResult(item.place_id, item.lat, item.lon, item.name, item.display_name)}
                                    >
                                        <View style={[styles.resultIconBox, { backgroundColor: colors.primary + '15' }]}>
                                            <Ionicons name="location-outline" size={20} color={colors.primary} />
                                        </View>
                                        <View style={styles.resultTextBox}>
                                            <Text style={[styles.resultName, { color: colors.heading }]}>{item.name}</Text>
                                            <Text style={[styles.resultAddress, { color: colors.text }]} numberOfLines={1}>{item.display_name}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    searchQuery.length > 1 ? (
                                        <View style={styles.emptySearch}>
                                            <Text style={[styles.emptySearchText, { color: colors.text }]}>No locations found</Text>
                                        </View>
                                    ) : null
                                }
                            />
                        )}
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Confirm Save Modal */}
            <MakiModal
                visible={showConfirmSaveModal}
                type="warning"
                title={isEditing ? "Update Address?" : "Save Address?"}
                message={`Do you want to ${isEditing ? 'update' : 'save'} this address to your profile?\n\n${selectedPinAddress}`}
                confirmText={isEditing ? "Update" : "Save"}
                cancelText="Not yet"
                onConfirm={confirmAddDetails}
                onCancel={() => setShowConfirmSaveModal(false)}
            />

            {/* Saved Success Modal */}
            <MakiModal
                visible={showSavedModal}
                type="success"
                title={isEditing ? "Address Updated" : "Address Saved"}
                message={isEditing ? "Your delivery address has been updated successfully." : "Your new delivery address has been added to your profile."}
                showFooter={false}
                onConfirm={() => {}}
            />

            {/* Duplicate Modal */}
            <MakiModal
                visible={showDuplicateModal}
                type="warning"
                title="Duplicate Address"
                message="This address is already in your address book."
                confirmText="Understood"
                onConfirm={() => setShowDuplicateModal(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    mapLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    backOverlayBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 10,
    },
    searchOverlayBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 80,
        right: 20,
        height: 48,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 10,
    },
    searchPlaceholderText: {
        fontSize: 15,
        marginLeft: 10,
        fontFamily: Typography.body,
    },
    pinIndicatorContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    pinIconContainer: {
        alignItems: 'center',
        marginBottom: 40, // Offset to point the tip at center
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    pinCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    pinStick: {
        width: 3,
        height: 20,
        marginTop: -2,
    },
    bottomPanel: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    panelHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 16,
    },
    locationIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationTitleBox: {
        flex: 1,
    },
    locationTitle: {
        fontSize: 18,
        fontWeight: '800',
        fontFamily: Typography.h1,
        marginBottom: 4,
    },
    locationSubtitle: {
        fontSize: 14,
        fontFamily: Typography.body,
        lineHeight: 20,
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4,
        marginBottom: 20,
        marginLeft: 64,
    },
    distanceText: {
        fontSize: 12,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    myLocationBtn: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
  selectBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  selectBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Typography.button,
    letterSpacing: 0.5,
  },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    searchModalContent: {
        flex: 1,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    closeSearchBtn: {
        padding: 4,
    },
    searchInputBox: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        fontFamily: Typography.body,
    },
    searchLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultsList: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        gap: 16,
    },
    resultIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultTextBox: {
        flex: 1,
    },
    resultName: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: Typography.h1,
        marginBottom: 2,
    },
    resultAddress: {
        fontSize: 13,
        fontFamily: Typography.body,
    },
    emptySearch: {
        alignItems: 'center',
        paddingTop: 40,
    },
    emptySearchText: {
        fontSize: 15,
        fontFamily: Typography.body,
    },
});

import { MaterialIcons } from '@expo/vector-icons';
