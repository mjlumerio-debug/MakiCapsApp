import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    SafeAreaView,
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
import { Food } from '../lib/menu_store';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type FoodDetailModalProps = {
    visible: boolean;
    onClose: () => void;
    item: Food | null;
    isFavorite: boolean;
    onToggleFavorite: (id: string) => void;
    onAddToCart: (item: Food, quantity: number) => void;
    onCheckout: () => void;
};

export default function FoodDetailModal({
    visible,
    onClose,
    item,
    isFavorite,
    onToggleFavorite,
    onAddToCart,
    onCheckout,
}: FoodDetailModalProps) {
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const opacity = useSharedValue(0);
    const [quantity, setQuantity] = useState(1);
    const [isExpanded, setIsExpanded] = useState(false);

    const flyX = useSharedValue(0);
    const flyY = useSharedValue(0);
    const flyScale = useSharedValue(0);
    const flyOpacity = useSharedValue(0);

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
        backgroundColor: '#FF5800',
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
                    <Feather name="plus" size={14} color="#FFF" />
                </Animated.View>

                <Animated.View style={[styles.container, animatedStyle]}>
                    <View style={styles.modalBody}>
                        {/* Transparent Header overlaying image */}
                        <View style={styles.headerRow}>
                            <TouchableOpacity style={styles.backBtn} onPress={handleClose}>
                                <Feather name="arrow-left" size={24} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Details</Text>
                            <View style={styles.headerPlaceholder} />
                        </View>

                        {/* Full-Width Image "Wrapping" Style */}
                        <View style={styles.imageWrap}>
                            <Image
                                source={item.image}
                                style={styles.foodImage}
                                contentFit="cover"
                                transition={300}
                            />
                            {/* Subtle dark overlay at top for back button legibility */}
                            <View style={styles.topShadow} />
                        </View>

                        {/* Dark Content Card */}
                        <View style={styles.darkContentCard}>
                            <View style={styles.titleRow}>
                                <View style={styles.titleInfo}>
                                    <Text style={styles.foodName}>{item.title}</Text>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.fromLabel}>From: </Text>
                                        <Text style={styles.priceValue}>{item.price}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.favCircle}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        onToggleFavorite(item.id);
                                    }}
                                >
                                    <Ionicons
                                        name={isFavorite ? "heart" : "heart-outline"}
                                        size={24}
                                        color={isFavorite ? "#FF5800" : "#FFF"}
                                    />
                                </TouchableOpacity>
                            </View>

                            {item.description ? (
                                <View style={styles.descriptionHeaderContainer}>
                                    <Text style={styles.descriptionHeader}>Description</Text>
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
                                                    style={styles.modalDescription}
                                                    numberOfLines={(!isLong || isExpanded) ? undefined : 3}
                                                >
                                                    {item.description}
                                                </Text>
                                                {isLong && (
                                                    <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.seeMoreBtn}>
                                                        <Text style={styles.seeMoreText}>
                                                            {isExpanded ? 'See less' : 'See all'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    })()
                                ) : null}
                            </ScrollView>

                            <View style={styles.footerContainer}>
                                <View style={styles.divider} />

                                {/* Standardized Footer */}
                                <View style={styles.footerRow}>
                                    <View style={styles.qtyPill}>
                                        <TouchableOpacity
                                            style={styles.qtyBtn}
                                            onPress={() => setQuantity(Math.max(1, quantity - 1))}
                                        >
                                            <Ionicons name="remove" size={20} color="#BBB" />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyValue}>{quantity.toString().padStart(2, '0')}</Text>
                                        <TouchableOpacity
                                            style={styles.qtyBtnAdd}
                                            onPress={() => setQuantity(quantity + 1)}
                                        >
                                            <Ionicons name="add" size={20} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity style={styles.atcActionBtn} onPress={handleAddToCart}>
                                        <Text style={styles.atcBtnText}>Add to Cart</Text>
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
        backgroundColor: '#0D0D0D', // Theme like old UI
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
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
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
        backgroundColor: '#121212',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        marginTop: -30, // Slight overlap for "wrapping" feel
        paddingHorizontal: 25,
        paddingTop: 10, // Adjusted for ScrollView
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
        backgroundColor: '#121212',
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
        color: '#FFF',
        marginBottom: 4,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fromLabel: {
        fontSize: 15,
        color: '#8A8A8A',
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 15,
        color: '#FF5800',
        fontWeight: '700',
    },
    descriptionContainer: {
        marginTop: 20,
        alignItems: 'flex-start',
        width: '100%',
    },
    descriptionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 8,
    },
    modalDescription: {
        color: '#A0A0A0',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'left',
    },
    seeMoreBtn: {
        marginTop: 4,
    },
    seeMoreText: {
        color: '#FF5800',
        fontSize: 13,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        width: '100%',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 20,
        borderRadius: 1,
    },
    favCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.05)',
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
        backgroundColor: '#1A1A1A',
        borderRadius: 30,
        padding: 5,
    },
    qtyBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyBtnAdd: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#D94F3D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyValue: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
        marginHorizontal: 12,
    },
    atcActionBtn: {
        backgroundColor: '#FF5800',
        paddingHorizontal: 35,
        paddingVertical: 18,
        borderRadius: 30,
        flex: 1,
        marginLeft: 15,
        alignItems: 'center',
        shadowColor: '#FF5800',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    atcBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
});
