import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';

interface CheckboxProps {
    label: string;
    checked: boolean;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
}

export function Checkbox({ label, checked, onPress, style }: CheckboxProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[
                styles.checkbox,
                {
                    borderColor: theme.tint,
                    backgroundColor: checked ? theme.tint : 'transparent',
                    borderWidth: checked ? 0 : 2
                }
            ]}>
                {checked && <Ionicons name="checkmark" size={14} color={theme.white} />}
            </View>
            <Text style={[styles.label, { color: theme.text, fontFamily: Typography.body }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    label: {
        fontSize: 14,
    },
});
