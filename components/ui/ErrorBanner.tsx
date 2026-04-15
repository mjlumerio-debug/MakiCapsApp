import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';

interface ErrorBannerProps {
    message: string;
    /** Reserve a fixed height slot so other UI elements never shift. Default: true */
    reserved?: boolean;
    reservedHeight?: number;
    style?: any;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
    message,
    reserved = true,
    reservedHeight = 64,
    style,
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const shake = useSharedValue(0);

    const animatedShakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shake.value }],
    }));

    useEffect(() => {
        if (message) {
            shake.value = withSequence(
                withTiming(-8, { duration: 45 }),
                withTiming(8, { duration: 45 }),
                withTiming(-8, { duration: 45 }),
                withTiming(8, { duration: 45 }),
                withTiming(0, { duration: 45 })
            );
        }
    }, [message]);

    // Reserved slot: always occupies space but only shows content when there's an error
    if (reserved) {
        return (
            <View style={[{ height: reservedHeight, justifyContent: 'center' }, style]}>
                {message ? (
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        exiting={FadeOut.duration(200)}
                        style={[
                            styles.container,
                            {
                                backgroundColor: colorScheme === 'light' ? '#FFF5F5' : '#1A0D0D',
                                borderColor: theme.tint + '50',
                            },
                            animatedShakeStyle,
                        ]}
                    >
                        <Ionicons name="alert-circle" size={18} color={theme.tint} style={styles.icon} />
                        <Text style={[styles.text, { color: theme.text }]} numberOfLines={2}>
                            {message}
                        </Text>
                    </Animated.View>
                ) : null}
            </View>
        );
    }

    // Non-reserved: collapses entirely when no error
    if (!message) return null;

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={[
                styles.container,
                {
                    backgroundColor: colorScheme === 'light' ? '#FFF5F5' : '#1A0D0D',
                    borderColor: theme.tint + '50',
                },
                animatedShakeStyle,
                style,
            ]}
        >
            <Ionicons name="alert-circle" size={18} color={theme.tint} style={styles.icon} />
            <Text style={[styles.text, { color: theme.text }]} numberOfLines={2}>
                {message}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    icon: {
        marginRight: 8,
        flexShrink: 0,
    },
    text: {
        flex: 1,
        fontFamily: Typography.body,
        fontSize: 13,
        lineHeight: 18,
    },
});
