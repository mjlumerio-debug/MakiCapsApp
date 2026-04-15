import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    KeyboardTypeOptions,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

interface ThemedInputProps {
    label?: string;
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: KeyboardTypeOptions;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    style?: StyleProp<ViewStyle>;
    iconName?: keyof typeof Ionicons.glyphMap;
    height?: number;
}

export function ThemedInput({
    label,
    placeholder,
    value,
    onChangeText,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
    style,
    iconName,
    height = 56
}: ThemedInputProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const [showPassword, setShowPassword] = useState(false);

    const focusAnim = useSharedValue(0);

    const animatedContainerStyle = useAnimatedStyle(() => {
        return {
            borderColor: interpolateColor(
                focusAnim.value,
                [0, 1],
                [theme.border, theme.primary]
            ),
            borderWidth: withTiming(focusAnim.value ? 2 : 1, { duration: 200 }),
        };
    });

    const handleFocus = () => {
        focusAnim.value = withTiming(1, { duration: 200 });
    };

    const handleBlur = () => {
        focusAnim.value = withTiming(0, { duration: 200 });
    };

    return (
        <View style={[styles.container, style]}>
            {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
            <Animated.View style={[
                styles.inputContainer,
                { backgroundColor: theme.background, height },
                animatedContainerStyle
            ]}>
                <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder={placeholder}
                    placeholderTextColor={theme.gray === '#F8F8F8' ? '#999' : '#666'}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry && !showPassword}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                {secureTextEntry ? (
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.icon}>
                        <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={theme.tint}
                        />
                    </TouchableOpacity>
                ) : iconName ? (
                    <View style={styles.icon}>
                        <Ionicons name={iconName} size={20} color={theme.tint} />
                    </View>
                ) : null}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontFamily: Typography.button,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        fontFamily: Typography.body,
    },
    icon: {
        marginLeft: 10,
    },
});
