import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import {
    Dimensions,
    Modal,
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
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/state/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type StockLimitModalProps = {
    visible: boolean;
    onClose: () => void;
    maxQuantity: number;
    currentInCart?: number;
    itemName?: string;
};

export default function StockLimitModal({
    visible,
    onClose,
    maxQuantity,
    currentInCart = 0,
    itemName,
}: StockLimitModalProps) {
    const { colors } = useAppTheme();

    const backdropOpacity = useSharedValue(0);
    const cardScale = useSharedValue(0.85);
    const cardOpacity = useSharedValue(0);
    const iconScale = useSharedValue(0);
    const progressWidth = useSharedValue(0);
    const shakeX = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Backdrop fade in
            backdropOpacity.value = withTiming(1, { duration: 250 });

            // Card entrance with bounce
            cardScale.value = withSpring(1, {
                damping: 14,
                stiffness: 160,
                mass: 0.6,
            });
            cardOpacity.value = withTiming(1, { duration: 200 });

            // Icon pop + shake
            iconScale.value = withSequence(
                withTiming(0, { duration: 0 }),
                withSpring(1.15, { damping: 8, stiffness: 200 }),
                withSpring(1, { damping: 12, stiffness: 180 }),
            );

            // Shake the icon slightly
            shakeX.value = withSequence(
                withTiming(0, { duration: 200 }),
                withTiming(-6, { duration: 60 }),
                withTiming(6, { duration: 60 }),
                withTiming(-4, { duration: 60 }),
                withTiming(4, { duration: 60 }),
                withTiming(0, { duration: 60 }),
            );

            // Progress bar animation
            const fillPercent = maxQuantity > 0 ? Math.min((currentInCart / maxQuantity) * 100, 100) : 100;
            progressWidth.value = withTiming(fillPercent, {
                duration: 800,
                easing: Easing.out(Easing.cubic),
            });
        } else {
            backdropOpacity.value = 0;
            cardScale.value = 0.85;
            cardOpacity.value = 0;
            iconScale.value = 0;
            progressWidth.value = 0;
            shakeX.value = 0;
        }
    }, [visible]);

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        backdropOpacity.value = withTiming(0, { duration: 180 });
        cardScale.value = withTiming(0.9, { duration: 180 });
        cardOpacity.value = withTiming(0, { duration: 180 }, (finished) => {
            if (finished) runOnJS(onClose)();
        });
    };

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: iconScale.value },
            { translateX: shakeX.value },
        ],
    }));

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progressWidth.value}%`,
    }));

    const remaining = Math.max(0, maxQuantity - currentInCart);
    const isFull = currentInCart >= maxQuantity;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={handleClose}
                    />
                </Animated.View>

                <Animated.View style={[styles.card, { backgroundColor: colors.surface }, cardStyle]}>
                    {/* Accent Top Bar */}
                    <View style={[styles.accentBar, { backgroundColor: '#FF6B35' }]} />

                    {/* Icon Circle */}
                    <Animated.View style={[styles.iconCircle, iconStyle]}>
                        <View style={styles.iconInner}>
                            <Ionicons name="alert-circle" size={36} color="#FF6B35" />
                        </View>
                    </Animated.View>

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.heading }]}>Stock Limit Reached</Text>

                    {/* Item Name */}
                    {itemName && (
                        <View style={[styles.itemNamePill, { backgroundColor: colors.primary + '12' }]}>
                            <Ionicons name="fast-food-outline" size={14} color={colors.primary} />
                            <Text style={[styles.itemNameText, { color: colors.primary }]} numberOfLines={1}>
                                {itemName}
                            </Text>
                        </View>
                    )}

                    {/* Message */}
                    <Text style={[styles.message, { color: colors.text }]}>
                        {isFull
                            ? `Only ${maxQuantity} serving${maxQuantity !== 1 ? 's' : ''} available and you already have ${currentInCart} in your cart.`
                            : `Only ${maxQuantity} serving${maxQuantity !== 1 ? 's' : ''} available for this item.`}
                    </Text>

                    {/* Stock Gauge */}
                    <View style={styles.gaugeContainer}>
                        <View style={styles.gaugeHeader}>
                            <Text style={[styles.gaugeLabel, { color: colors.text }]}>Stock Availability</Text>
                            <Text style={[styles.gaugeValue, { color: isFull ? '#FF6B35' : colors.primary }]}>
                                {currentInCart}/{maxQuantity}
                            </Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: colors.background }]}>
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: isFull ? '#FF6B35' : colors.primary },
                                    progressStyle,
                                ]}
                            />
                        </View>
                        <View style={styles.gaugeFooter}>
                            <View style={styles.gaugeStat}>
                                <View style={[styles.statDot, { backgroundColor: isFull ? '#FF6B35' : colors.primary }]} />
                                <Text style={[styles.statText, { color: colors.text }]}>
                                    In cart: {currentInCart}
                                </Text>
                            </View>
                            <View style={styles.gaugeStat}>
                                <View style={[styles.statDot, { backgroundColor: remaining > 0 ? '#4CAF50' : '#EF4444' }]} />
                                <Text style={[styles.statText, { color: colors.text }]}>
                                    Remaining: {remaining}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* CTA Button */}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleClose}
                        style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                    >
                        <Ionicons name="checkmark-circle" size={20} color={colors.background} />
                        <Text style={[styles.ctaText, { color: colors.background }]}>Got It</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 28,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        overflow: 'hidden',
        alignItems: 'center',
        paddingBottom: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.2,
        shadowRadius: 32,
        elevation: 20,
    },
    accentBar: {
        width: '100%',
        height: 5,
    },
    iconCircle: {
        marginTop: 28,
        marginBottom: 16,
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 107, 53, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 6,
    },
    itemNamePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 12,
        gap: 6,
        maxWidth: SCREEN_WIDTH * 0.7,
    },
    itemNameText: {
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 1,
    },
    message: {
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        paddingHorizontal: 28,
        marginBottom: 22,
    },
    gaugeContainer: {
        width: '100%',
        paddingHorizontal: 28,
        marginBottom: 24,
    },
    gaugeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    gaugeLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    gaugeValue: {
        fontSize: 14,
        fontWeight: '800',
    },
    progressTrack: {
        width: '100%',
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 5,
    },
    gaugeFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    gaugeStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statText: {
        fontSize: 12,
        fontWeight: '500',
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 28,
        marginHorizontal: 28,
        width: SCREEN_WIDTH * 0.65,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    ctaText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
