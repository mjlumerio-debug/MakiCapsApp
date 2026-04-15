import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
    ViewStyle
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

interface ThemedButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'social' | 'dark';
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ThemedButton({
    title,
    onPress,
    variant = 'primary',
    style,
    textStyle,
    loading = false,
    disabled = false,
    icon
}: ThemedButtonProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const getButtonStyle = (): ViewStyle => {
        switch (variant) {
            case 'secondary':
                return { backgroundColor: theme.secondary };
            case 'outline':
                return { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.tint };
            case 'social':
                return { backgroundColor: theme.white, borderWidth: 1, borderColor: theme.border, borderRadius: 50, width: 60, height: 60, justifyContent: 'center', alignItems: 'center' };
            case 'dark':
                return { backgroundColor: theme.secondary };
            default:
                return { backgroundColor: theme.primary };
        }
    };

    const getTextColor = (): string => {
        switch (variant) {
            case 'outline':
                return theme.text;
            case 'social':
                return theme.text;
            case 'dark':
                return theme.white;
            default:
                return theme.white;
        }
    };

    if (variant === 'social') {
        return (
            <AnimatedPressable
                style={[styles.socialButton, getButtonStyle(), style, animatedStyle]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
            >
                {icon}
            </AnimatedPressable>
        );
    }

    return (
        <AnimatedPressable
            style={[styles.button, getButtonStyle(), style, (disabled || loading) && styles.disabled, animatedStyle]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <View style={styles.content}>
                    {icon && <View style={styles.iconContainer}>{icon}</View>}
                    <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
                </View>
            )}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    button: {
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    socialButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontFamily: Typography.button,
    },
    iconContainer: {
        marginRight: 10,
    },
    disabled: {
        opacity: 0.6,
    },
});
