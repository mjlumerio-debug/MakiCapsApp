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
    StatusBar,
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
        // Keep full address aligned with parsed parts, while removing plus codes.
        // If fallback formatter already produced a landmark-first label, do not overwrite it.
        if (isFallbackLabel) {
            return;
        }
        const parts = [subdivision, street, barangay, city, province]
            .map((part) => sanitizeAddressPart(part))
            .filter((part) => !!part);
        if (parts.length > 0) {
            const composed = parts.join(', ');
            setFullAddress((prev) => {
                // Preserve an existing fallback landmark label if it is already more descriptive.
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
                // Smoothly focus on the existing address
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
        // Master variables to accumulate the best data from all providers
        let masterStreet = '';
        let masterBarangay = '';
        let masterSubdiv = '';
        let masterCity = '';
        let masterProvince = '';
        let masterFullAddress = '';
        let nearbyEstablishment = '';

        try {
            // LAYER 1: Google Maps (Primary Structure)
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

            // LAYER 2: OpenStreetMap (Street & Subdivision Specialist)
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

            // LAYER 3: BigDataCloud (Administrative Specialist)
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

            // LAYER 4: Expo Native (Final Street Fallback)
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

            // FINAL STEP: Process Search Selection or Deep Details
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

            // Cleanup: Avoid duplicating Barangay or City into Subdivision
            if (masterSubdiv && !isSubdivKeyword(masterSubdiv) && (normalize(masterSubdiv) === normalize(masterBarangay) || normalize(masterSubdiv) === normalize(masterCity))) {
                masterSubdiv = '';
            }
            if (masterSubdiv && /^[A-Z0-9]{2,8}\+[A-Z0-9]{2}/i.test(masterSubdiv)) masterSubdiv = ''; // Plus Code cleanup
            if (!isSubdivKeyword(masterSubdiv)) masterSubdiv = '';
            if (masterStreet && !isStreetKeyword(masterStreet)) {
                const streetNorm = normalize(masterStreet);
                if (streetNorm === normalize(masterBarangay) || streetNorm === normalize(masterCity)) {
                    masterStreet = '';
                }
            }

            // If there is no street at the exact pin, use nearest establishment within 100m.
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

            // COMMIT ALL RESULTS
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
                // Use Google Places TextSearch with widened Location Biasing (20km)
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

            // Fallback: Photon API
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
        setSelectedPinAddress(stripPlusCode(fullAddress));
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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#EBEBEB" />

            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={true}
                showsMyLocationButton={false}
                onRegionChangeComplete={onRegionChangeComplete}
            />

            {isLoadingLocation && (
                <View style={styles.mapLoadingOverlay}>
                    <ActivityIndicator size="large" color="#FF5800" />
                </View>
            )}

            <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backPlainBtn} activeOpacity={0.85}>
                    <Feather name="arrow-left" size={20} color="#2C2C2C" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.searchBar}
                    activeOpacity={0.9}
                    onPress={() => setIsSearchModalVisible(true)}
                >
                    <Feather name="map-pin" size={16} color="#9CA3AF" />
                    <Text style={styles.searchBarText}>Search for an address</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.centerPinWrap} pointerEvents="box-none">
                <TouchableOpacity
                    style={styles.selectDeliveryChipOuter}
                    activeOpacity={0.9}
                    disabled={!fullAddress || isFetchingAddress}
                    onPress={handleSelectDeliveryAddress}
                >
                    <View style={styles.selectDeliveryChip}>
                        <Text style={styles.selectDeliveryChipText}>Select Delivery Address</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.pinPulse} />
                <View style={styles.pinDot}>
                    <Ionicons name="location-sharp" size={26} color="#FF7A00" />
                </View>
            </View>

            <TouchableOpacity
                style={[styles.gpsFloatingBtn, { bottom: Math.max(insets.bottom, 12) + 216 }]}
                onPress={getCurrentLocation}
                activeOpacity={0.85}
                disabled={isLoadingLocation}
            >
                <Feather name="crosshair" size={18} color="#4B5563" />
            </TouchableOpacity>

            <KeyboardAvoidingView
                pointerEvents="box-none"
                style={styles.bottomPanelContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
                    <View style={styles.bottomTitleRow}>
                        <Ionicons name="location-outline" size={16} color="#F07A2A" />
                        <Text style={styles.bottomTitle}>Select delivery location</Text>
                    </View>
                    <Text style={styles.bottomSubText}>Pin your exact spot on the map for accurate delivery.</Text>
                    <View style={styles.bottomNoteRow}>
                        <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                        <Text style={styles.bottomNoteText}>Your order will be delivered to the pinned location.</Text>
                    </View>

                    <LocationCard
                        landmark={pinTitle || 'Pinned Location'}
                        address={livePinLabel || pinDetailLine || 'Pin your exact spot on the map.'}
                        distanceText={
                            distanceFromUserMeters > 0
                                ? `${distanceFromUserMeters} m away from your location`
                                : 'Detecting exact distance...'
                        }
                        buttonText="Select Address"
                        selected={hasSelectedPin}
                        disabled={!fullAddress || isFetchingAddress}
                        onPress={handleSelectDeliveryAddress}
                    />

                    <View style={styles.bottomDivider} />
                    <TouchableOpacity
                        style={[
                            styles.detailsBtn,
                            (!hasSelectedPin || isFetchingAddress) && styles.detailsBtnDisabled
                        ]}
                        disabled={!hasSelectedPin || isFetchingAddress}
                        onPress={handleAddDetails}
                    >
                        <Text
                            style={[
                                styles.detailsBtnText,
                                (!hasSelectedPin || isFetchingAddress) && styles.detailsBtnTextDisabled
                            ]}
                        >
                            Add Details
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <Modal 
                visible={isSearchModalVisible} 
                animationType="slide" 
                transparent={false}
                presentationStyle="fullScreen"
                statusBarTranslucent={true}
            >
                <SafeAreaView style={styles.container}>
                    <View style={styles.searchHeader}>
                        <TouchableOpacity onPress={() => setIsSearchModalVisible(false)} style={styles.backBtn} activeOpacity={0.8}>
                            <Feather name="arrow-left" size={24} color="#2C2C2C" />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search your location..."
                            returnKeyType="search"
                            onSubmitEditing={searchLocation}
                            autoFocus
                        />
                        <TouchableOpacity onPress={searchLocation} style={styles.searchIconBtn}>
                            <Feather name="search" size={20} color="#FF5800" />
                        </TouchableOpacity>
                    </View>

                    {isSearching ? (
                        <ActivityIndicator size="large" color="#FF5800" style={{ marginTop: 40 }} />
                    ) : (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1 }}
                        >
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item) => item.place_id.toString()}
                                contentContainerStyle={styles.searchResults}
                                keyboardShouldPersistTaps="handled"
                                ListEmptyComponent={
                                    searchQuery.length > 0 ? (
                                        <View style={styles.searchEmpty}>
                                            <Text style={styles.searchEmptyText}>No locations found. Press search or try different keywords.</Text>
                                        </View>
                                    ) : null
                                }
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.searchResultItem}
                                        onPress={() => handleSelectSearchResult(item.place_id, item.lat, item.lon, item.name, item.display_name)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.searchResultIcon}>
                                            <Ionicons name="location-outline" size={20} color="#6B7280" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.searchResultName} numberOfLines={1}>
                                                {item.name || item.display_name.split(',')[0]}
                                            </Text>
                                            <Text style={styles.searchResultAddress} numberOfLines={2}>
                                                {item.display_name}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        </KeyboardAvoidingView>
                    )}
                </SafeAreaView>
            </Modal>

            <MakiModal
                visible={showConfirmSaveModal}
                type="warning"
                title="Save This Delivery Pin?"
                message="This will save your currently selected pinned location as a delivery address."
                confirmText="Save Address"
                cancelText="Review Again"
                onCancel={() => setShowConfirmSaveModal(false)}
                onConfirm={confirmAddDetails}
            />

            <MakiModal
                visible={showSavedModal}
                type="success"
                title="Address Saved"
                message="Your pinned delivery location has been saved successfully."
                onConfirm={() => {
                    setShowSavedModal(false);
                    router.back();
                }}
            />

            <MakiModal
                visible={showDuplicateModal}
                type="warning"
                title="Duplicate Address"
                message="This pinned location is already in your saved addresses."
                onConfirm={() => setShowDuplicateModal(false)}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ECEEEF',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    mapLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topOverlay: {
        position: 'absolute',
        top: 0,
        left: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    backPlainBtn: {
        width: 34,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 6,
    },
    searchBar: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DCDCDC',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 2,
    },
    searchBarText: {
        marginLeft: 10,
        fontSize: 16,
        color: '#9B8C82',
        flex: 1,
    },
    centerPinWrap: {
        position: 'absolute',
        top: '31%',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    selectDeliveryChipOuter: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 8,
        paddingVertical: 8,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    selectDeliveryChip: {
        backgroundColor: '#F97316',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    selectDeliveryChipText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    pinPulse: {
        width: 170,
        height: 170,
        borderRadius: 85,
        backgroundColor: 'rgba(82, 124, 178, 0.22)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinDot: {
        position: 'absolute',
        top: '58%',
        transform: [{ translateY: -14 }],
    },
    gpsFloatingBtn: {
        position: 'absolute',
        right: 18,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
    bottomPanelContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    bottomPanel: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 18,
        minHeight: 260,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
    },
    bottomTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    bottomTitle: {
        marginLeft: 6,
        fontSize: 20,
        fontWeight: '700',
        color: '#2F211A',
    },
    bottomSubText: {
        marginTop: 8,
        fontSize: 14,
        color: '#7A6960',
        lineHeight: 20,
    },
    bottomNoteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    bottomNoteText: {
        marginLeft: 6,
        fontSize: 13,
        color: '#8A7A71',
    },
    fetchingText: {
        marginTop: 8,
        fontSize: 13,
        color: '#FF5800',
        fontWeight: '600',
    },
    pinDetailsCard: {
        marginTop: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D9D9D9',
        backgroundColor: '#FFFFFF',
    },
    pinDetailsCardActive: {
        borderColor: '#CFCFCF',
        backgroundColor: '#FFFFFF',
    },
    pinHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    pinTitleIconWrap: {
        marginTop: 1,
        marginRight: 8,
    },
    pinTitleText: {
        flex: 1,
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '700',
        color: '#2F2F35',
        minWidth: 0,
    },
    pinDetailText: {
        fontSize: 18,
        color: '#3C3C42',
        lineHeight: 28,
    },
    pinDistanceText: {
        marginTop: 6,
        fontSize: 16,
        color: '#787881',
        lineHeight: 24,
    },
    pinSelectBtn: {
        marginTop: 16,
        borderWidth: 2,
        borderColor: '#96969B',
        borderRadius: 999,
        height: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
    },
    pinSelectBtnDisabled: {
        opacity: 0.45,
    },
    pinSelectBtnText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2C2C2C',
    },
    bottomDivider: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#ECDDD2',
    },
    detailsBtn: {
        marginTop: 10,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsBtnDisabled: {
        backgroundColor: '#F3D4BF',
    },
    detailsBtnText: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    detailsBtnTextDisabled: {
        color: '#D8A987',
    },
    formScrollContent: {
        paddingBottom: 12,
    },
    detailsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    minimizeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1F2937',
    },
    inputDisabled: {
        backgroundColor: '#F1F5F9',
        color: '#9CA3AF',
    },
    row: {
        flexDirection: 'row',
    },
    halfInputLeft: {
        flex: 1,
        marginRight: 8,
    },
    halfInputRight: {
        flex: 1,
        marginLeft: 8,
    },
    textArea: {
        height: 84,
        textAlignVertical: 'top',
        paddingTop: 10,
    },
    saveBtn: {
        marginTop: 4,
        backgroundColor: '#D70022',
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveBtnDisabled: {
        backgroundColor: '#E5E7EB',
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EDE0D7',
        backgroundColor: '#FFF9F5',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#FFF3EA',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        marginHorizontal: 12,
        color: '#2F211A',
    },
    searchIconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchResults: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EFE4DC',
    },
    searchResultIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF3EA',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    searchResultName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    searchResultAddress: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    searchEmpty: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    searchEmptyText: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 14,
        lineHeight: 20,
    },
});
