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
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/state/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OutOfRangeModalProps = {
    visible: boolean;
    onAcknowledge: () => void;
    branchName?: string;
    message?: string;
};

export default function OutOfRangeModal({
    visible,
    onAcknowledge,
    branchName,
    message,
}: OutOfRangeModalProps) {
    const { colors } = useAppTheme();

    const backdropOpacity = useSharedValue(0);
    const cardScale = useSharedValue(0.85);
    const cardOpacity = useSharedValue(0);
    const iconScale = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const pinBounce = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Backdrop fade
            backdropOpacity.value = withTiming(1, { duration: 280 });

            // Card entrance
            cardScale.value = withSpring(1, {
                damping: 15,
                stiffness: 150,
                mass: 0.7,
            });
            cardOpacity.value = withTiming(1, { duration: 220 });

            // Icon pop
            iconScale.value = withSequence(
                withTiming(0, { duration: 0 }),
                withSpring(1.2, { damping: 6, stiffness: 220 }),
                withSpring(1, { damping: 10, stiffness: 200 }),
            );

            // Pin bounce animation
            pinBounce.value = withSequence(
                withTiming(0, { duration: 250 }),
                withTiming(-8, { duration: 150, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
                withTiming(-4, { duration: 120, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }),
            );

            // Pulse ring
            pulseScale.value = withSequence(
                withTiming(1, { duration: 0 }),
                withTiming(1.6, { duration: 800, easing: Easing.out(Easing.cubic) }),
            );
        } else {
            backdropOpacity.value = 0;
            cardScale.value = 0.85;
            cardOpacity.value = 0;
            iconScale.value = 0;
            pulseScale.value = 1;
            pinBounce.value = 0;
        }
    }, [visible]);

    const handleAcknowledge = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Start exit animation for visual polish
        backdropOpacity.value = withTiming(0, { duration: 200 });
        cardScale.value = withTiming(0.9, { duration: 200 });
        cardOpacity.value = withTiming(0, { duration: 200 });

        // Call onAcknowledge directly after a short delay for visual feedback.
        // We CANNOT rely on the animation callback (runOnJS) because when the
        // parent sets visible=false, the useEffect resets shared values to 0,
        // which cancels running animations and their callbacks never fire.
        setTimeout(() => {
            onAcknowledge();
        }, 220);
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
            { translateY: pinBounce.value },
        ],
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: 1 - (pulseScale.value - 1) / 0.6,
    }));

    const displayMessage = message
        || 'Your cart has been cleared because your current location is outside our delivery range.';

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={() => {}}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, backdropStyle]} />

                <Animated.View style={[styles.card, { backgroundColor: colors.surface }, cardStyle]}>
                    {/* Top Accent */}
                    <View style={[styles.accentBar, { backgroundColor: '#EF4444' }]} />

                    {/* Icon with Pulse */}
                    <View style={styles.iconContainer}>
                        <Animated.View style={[styles.pulseRing, pulseStyle]} />
                        <Animated.View style={[styles.iconCircle, iconStyle]}>
                            <View style={styles.iconInner}>
                                <Ionicons name="location-outline" size={34} color="#EF4444" />
                            </View>
                        </Animated.View>
                    </View>

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.heading }]}>Outside Delivery Range</Text>

                    {/* Branch Name Pill */}
                    {branchName && (
                        <View style={[styles.branchPill, { backgroundColor: '#EF4444' + '12' }]}>
                            <Ionicons name="storefront-outline" size={14} color="#EF4444" />
                            <Text style={[styles.branchText, { color: '#EF4444' }]} numberOfLines={1}>
                                {branchName}
                            </Text>
                        </View>
                    )}

                    {/* Message */}
                    <Text style={[styles.message, { color: colors.text }]}>
                        {displayMessage}
                    </Text>

                    {/* Info Box */}
                    <View style={[styles.infoBox, { backgroundColor: colors.background }]}>
                        <View style={styles.infoRow}>
                            <View style={[styles.infoDot, { backgroundColor: '#EF4444' }]} />
                            <Text style={[styles.infoText, { color: colors.text }]}>
                                Your cart items have been removed
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <View style={[styles.infoDot, { backgroundColor: '#F59E0B' }]} />
                            <Text style={[styles.infoText, { color: colors.text }]}>
                                You'll be redirected to the home screen
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <View style={[styles.infoDot, { backgroundColor: '#10B981' }]} />
                            <Text style={[styles.infoText, { color: colors.text }]}>
                                Try a different delivery address to continue
                            </Text>
                        </View>
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleAcknowledge}
                        style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                    >
                        <Ionicons name="home-outline" size={20} color={colors.background} />
                        <Text style={[styles.ctaText, { color: colors.background }]}>OK, Go to Home</Text>
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
        shadowOpacity: 0.22,
        shadowRadius: 32,
        elevation: 22,
    },
    accentBar: {
        width: '100%',
        height: 5,
    },
    iconContainer: {
        marginTop: 28,
        marginBottom: 16,
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#EF4444',
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 21,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    branchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 12,
        gap: 6,
        maxWidth: SCREEN_WIDTH * 0.7,
    },
    branchText: {
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 1,
    },
    message: {
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        paddingHorizontal: 28,
        marginBottom: 20,
    },
    infoBox: {
        width: '100%',
        marginHorizontal: 28,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 16,
        marginBottom: 24,
        gap: 12,
        marginLeft: 28,
        marginRight: 28,
        alignSelf: 'center',
        maxWidth: SCREEN_WIDTH * 0.78,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    infoText: {
        fontSize: 12.5,
        fontWeight: '500',
        flex: 1,
        lineHeight: 17,
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        paddingHorizontal: 36,
        borderRadius: 28,
        marginHorizontal: 28,
        width: SCREEN_WIDTH * 0.68,
        gap: 10,
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
