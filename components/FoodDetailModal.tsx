import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { formatPeso, resolveProductImage, type Food } from '../lib/menu_store';
import { type CatalogMode } from '@/state/reducers/branchReducer';
import { useAppTheme } from '@/state/contexts/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type FoodDetailModalProps = {
    visible: boolean;
    onClose: () => void;
    item: Food | null;
    isFavorite: boolean;
    onToggleFavorite: (id: string) => void;
    onAddToCart: (item: Food, quantity: number) => void;
    onCheckout: () => void;
    catalogMode?: CatalogMode;
};

export default function FoodDetailModal({
    visible,
    onClose,
    item,
    isFavorite,
    onToggleFavorite,
    onAddToCart,
    onCheckout,
    catalogMode = 'branch',
}: FoodDetailModalProps) {
    const { colors, isDark } = useAppTheme();
    const isGlobalMode = catalogMode === 'global';
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const opacity = useSharedValue(0);
    const [quantity, setQuantity] = useState(1);
    const [isExpanded, setIsExpanded] = useState(false);

    const flyX = useSharedValue(0);
    const flyY = useSharedValue(0);
    const flyScale = useSharedValue(0);
    const flyOpacity = useSharedValue(0);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (visible) {
            setQuantity(1);
            setIsExpanded(false);
            opacity.value = withTiming(1, { duration: 300 });
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 100,
                mass: 0.8,
            });
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const flyStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        top: 0,
        left: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
        transform: [
            { translateX: flyX.value },
            { translateY: flyY.value },
            { scale: flyScale.value }
        ],
        opacity: flyOpacity.value,
        pointerEvents: 'none',
    }));

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(SCREEN_HEIGHT, {
            duration: 250,
            easing: Easing.out(Easing.quad),
        }, (finished) => {
            if (finished) {
                runOnJS(onClose)();
            }
        });
    };

    const handleAddToCart = () => {
        if (!item) return;
        const rawStock = item.max_quantity ?? item.stock;
        const hasStockLimit = rawStock != null && Number(rawStock) > 0;
        const maxQuantity = hasStockLimit ? Math.floor(Number(rawStock)) : Infinity;

        if (hasStockLimit && maxQuantity <= 0) {
            Alert.alert('Out of Stock', 'This item is currently out of stock.');
            return;
        }
        if (hasStockLimit && quantity > maxQuantity) {
            Alert.alert('Stock Limit', `Only ${maxQuantity} servings available.`);
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAddToCart(item, quantity);

        // Trigger fly animation
        flyX.value = SCREEN_WIDTH / 2 - 14;
        flyY.value = SCREEN_HEIGHT / 2;
        flyScale.value = 1;
        flyOpacity.value = 1;

        // Animate down to cart icon
        flyX.value = withTiming(SCREEN_WIDTH - 60, { duration: 600, easing: Easing.bezier(0.25, 1, 0.5, 1) });
        flyY.value = withTiming(SCREEN_HEIGHT - 60, { duration: 600, easing: Easing.bezier(0.25, 1, 0.5, 1) });
        flyScale.value = withTiming(0.2, { duration: 600 });
        flyOpacity.value = withTiming(0, { duration: 600 });
    };

    if (!item) return null;
    
    // 🍱 UI FORMATTING (Done in the UI layer only)
    const displayPrice = formatPeso(item.selling_price);
    const displayImage = resolveProductImage(item.image_path);

    const rawStock = item.max_quantity ?? item.stock;
    const hasStockLimit = rawStock != null && Number(rawStock) > 0;
    const stockCount = hasStockLimit ? Math.floor(Number(rawStock)) : Infinity;
    const isAvailableAtBranch = item.is_available;
    const isAvailable = !isGlobalMode && isAvailableAtBranch !== false;
    const canAddToCart = isAvailable && !isGlobalMode;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                {/* Dark Backdrop */}
                <Animated.View style={[styles.backdrop, backdropStyle]} />

                <Animated.View style={flyStyle}>
                    <Feather name="plus" size={14} color={colors.background} />
                </Animated.View>

                <Animated.View style={[styles.container, animatedStyle]}>
                    <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
                        {/* Transparent Header overlaying image */}
                        <View style={styles.headerRow}>
                            <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface + '66' }]} onPress={handleClose}>
                                <Feather name="arrow-left" size={24} color={colors.heading} />
                            </TouchableOpacity>
                            <Text style={[styles.headerTitle, { color: colors.heading }]}>Details</Text>
                            <View style={styles.headerPlaceholder} />
                        </View>

                        {/* Full-Width Image "Wrapping" Style */}
                        <View style={styles.imageWrap}>
                            <Image
                                source={{ uri: displayImage ?? undefined }}
                                style={styles.foodImage}
                                contentFit="cover"
                                transition={300}
                            />
                            {/* Subtle dark overlay at top for back button legibility */}
                            <View style={styles.topShadow} />

                            {/* Availability Badge */}
                            {item.availability_status && (
                                <View style={[
                                    styles.availabilityBadge,
                                    item.availability_status === 'available' ? styles.badgeGreen :
                                    item.availability_status === 'limited' ? styles.badgeYellow : styles.badgeRed
                                ]}>
                                    <Text style={styles.availabilityText}>
                                        {item.availability_status === 'available' ? 'Available' :
                                         item.availability_status === 'limited' ? 'Nearby' : 'Out of Stock'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Dark Content Card */}
                        <View style={[styles.darkContentCard, { backgroundColor: colors.surface }]}>
                            <View style={styles.titleRow}>
                                <View style={styles.titleInfo}>
                                    <Text style={[styles.foodName, { color: colors.heading }]}>{item.name}</Text>
                                    <View style={styles.priceContainer}>
                                        <Text style={[styles.fromLabel, { color: colors.text }]}>From: </Text>
                                        <Text style={[styles.priceValue, { color: colors.primary }]}>{displayPrice}</Text>
                                    </View>
                                    {isGlobalMode ? (
                                        <View style={styles.unavailableBanner}>
                                            <Ionicons name="globe-outline" size={16} color={colors.primary} />
                                            <Text style={[styles.stockStatusText, { color: colors.primary }]}>
                                                Select a delivery address to order
                                            </Text>
                                        </View>
                                    ) : !isAvailable ? (
                                        <View style={styles.unavailableBanner}>
                                            <Feather name="info" size={16} color="#FF6B6B" />
                                            <Text style={[styles.stockStatusText, styles.stockUnavailable]}>
                                                {!isAvailableAtBranch 
                                                    ? (item.availability_status === 'limited' ? 'Available in other branches' : 'Unavailable at branch') 
                                                    : 'Out of Stock'}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>

                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={[styles.favCircle, { backgroundColor: colors.primary + '1A' }]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        onToggleFavorite(item.id);
                                    }}
                                >
                                    <Ionicons
                                        name={isFavorite ? "heart" : "heart-outline"}
                                        size={24}
                                        color={isFavorite ? colors.primary : colors.text}
                                    />
                                </TouchableOpacity>
                            </View>

                            {item.description ? (
                                <View style={styles.descriptionHeaderContainer}>
                                    <Text style={[styles.descriptionHeader, { color: colors.heading }]}>Description</Text>
                                </View>
                            ) : null}

                            <ScrollView 
                                style={{ flex: 1 }}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.scrollContent}
                            >
                                {item.description ? (
                                    (() => {
                                        const words = item.description.trim().split(/\s+/);
                                        const isLong = words.length >= 50;

                                        return (
                                            <View style={styles.descriptionContainer}>
                                                <Text
                                                    style={[styles.modalDescription, { color: colors.text }]}
                                                    numberOfLines={(!isLong || isExpanded) ? undefined : 3}
                                                >
                                                    {item.description}
                                                </Text>
                                                {isLong && (
                                                    <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.seeMoreBtn}>
                                                        <Text style={[styles.seeMoreText, { color: colors.primary }]}>
                                                            {isExpanded ? 'See less' : 'See all'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    })()
                                ) : null}
                            </ScrollView>

                            <View style={[styles.footerContainer, { backgroundColor: colors.surface }]}>
                                <View style={[styles.divider, { borderColor: colors.primary }]} />

                                {/* Standardized Footer */}
                                <View style={styles.footerRow}>
                                    <View style={[styles.qtyPill, { backgroundColor: colors.background }]}>
                                        <TouchableOpacity
                                            style={[styles.qtyBtn, { borderColor: colors.surface }]}
                                            onPress={() => setQuantity(Math.max(1, quantity - 1))}
                                        >
                                            <Ionicons name="remove" size={20} color={colors.text} />
                                        </TouchableOpacity>
                                        <Text style={[styles.qtyValue, { color: colors.heading }]}>{quantity.toString().padStart(2, '0')}</Text>
                                        <TouchableOpacity
                                            style={[styles.qtyBtnAdd, { backgroundColor: colors.primary }]}
                                            onPress={() => {
                                                if (hasStockLimit && quantity >= stockCount) {
                                                    Alert.alert('Stock Limit', `Only ${stockCount} servings available.`);
                                                    return;
                                                }
                                                setQuantity(quantity + 1);
                                            }}
                                        >
                                            <Ionicons name="add" size={20} color={colors.background} />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.atcActionBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, !canAddToCart && styles.atcActionBtnDisabled]}
                                        onPress={handleAddToCart}
                                        disabled={!canAddToCart}
                                    >
                                        <Text style={[styles.atcBtnText, { color: colors.background }]}>{isGlobalMode ? 'Browse Only' : (isAvailable ? 'Add to Cart' : 'Unavailable')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    container: {
        height: SCREEN_HEIGHT * 0.9,
        width: SCREEN_WIDTH,
        backgroundColor: 'transparent',
    },
    modalBody: {
        flex: 1,
        backgroundColor: '#FBEAD6', // Champagne
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 30,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(240, 196, 203, 0.4)', // Blush with opacity
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4A2C35', // Heading Mauve
    },
    headerPlaceholder: {
        width: 44,
    },
    imageWrap: {
        height: SCREEN_HEIGHT * 0.45,
        width: '100%',
        position: 'relative',
    },
    foodImage: {
        width: '100%',
        height: '100%',
    },
    topShadow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
        backgroundColor: 'transparent', // Could add a tiny gradient if needed
    },
    darkContentCard: {
        flex: 1,
        backgroundColor: '#D38C9D', // 30% Blush
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        marginTop: -30,
        paddingHorizontal: 25,
        paddingTop: 10,
        paddingBottom: 20,
    },
    scrollContent: {
        paddingTop: 0, // Removed padding since header is now fixed
        paddingBottom: 20,
    },
    descriptionHeaderContainer: {
        marginTop: 20,
        marginBottom: 8,
    },
    footerContainer: {
        backgroundColor: '#D38C9D', // 30% Blush
        paddingBottom: 30,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    titleInfo: {
        flex: 1,
    },
    foodName: {
        fontSize: 26,
        fontWeight: '800',
        color: '#4A2C35', // Heading Mauve
        marginBottom: 4,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fromLabel: {
        fontSize: 15,
        color: '#7A5560', // Body Mauve
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 15,
        color: '#D38C9D', // Antique Rose
        fontWeight: '700',
    },
    stockStatusText: {
        marginLeft: 8,
        fontSize: 13,
        fontWeight: '600',
    },
    stockAvailable: {
        color: '#4CAF50',
    },
    stockUnavailable: {
        color: '#FF6B6B',
    },
    descriptionContainer: {
        marginTop: 20,
        alignItems: 'flex-start',
        width: '100%',
    },
    descriptionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4A2C35', // Heading Mauve
        marginBottom: 8,
    },
    modalDescription: {
        color: '#7A5560', // Body Mauve
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'left',
    },
    seeMoreBtn: {
        marginTop: 4,
    },
    seeMoreText: {
        color: '#D38C9D', // Antique Rose
        fontSize: 13,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        width: '100%',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#D38C9D', // Antique Rose
        marginBottom: 20,
        borderRadius: 1,
        opacity: 0.3,
    },
    favCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(200, 125, 135, 0.1)', // Antique Rose with low opacity
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 15,
    },
    flexSpacer: {
        flex: 1,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    qtyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FBEAD6', // Champagne
        borderRadius: 30,
        padding: 5,
    },
    qtyBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1.5,
        borderColor: '#D38C9D', // Blush
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyBtnAdd: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#D38C9D', // Antique Rose
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyValue: {
        fontSize: 17,
        fontWeight: '700',
        color: '#4A2C35', // Mauve
        marginHorizontal: 12,
    },
    atcActionBtn: {
        backgroundColor: '#D38C9D', // Antique Rose
        paddingHorizontal: 35,
        paddingVertical: 18,
        borderRadius: 30,
        flex: 1,
        marginLeft: 15,
        alignItems: 'center',
        shadowColor: '#D38C9D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    atcActionBtnDisabled: {
        backgroundColor: '#555',
        shadowOpacity: 0,
        elevation: 0,
    },
    atcBtnText: {
        color: '#FBEAD6', // Champagne
        fontSize: 18,
        fontWeight: '700',
    },
    // Availability Styles
    availabilityBadge: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        zIndex: 10,
    },
    badgeGreen: {
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
    },
    badgeYellow: {
        backgroundColor: 'rgba(245, 158, 11, 0.9)',
    },
    badgeRed: {
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
    },
    availabilityText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    unavailableBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginTop: 8,
    },
});

