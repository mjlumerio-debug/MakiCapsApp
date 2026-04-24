import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { Typography } from '@/constants/theme';

type MakiModalType = 'success' | 'delete' | 'warning';

type MakiModalProps = {
    visible: boolean;
    type: MakiModalType;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    showFooter?: boolean;
};

export default function MakiModal({
    visible,
    type,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Okay',
    cancelText = 'Cancel',
    showFooter = true,
}: MakiModalProps) {
    const { colors } = useAppTheme();
    if (!visible) return null;

    const isSuccess = type === 'success';

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onCancel}
        >
            <Animated.View 
                entering={FadeIn} 
                exiting={FadeOut}
                style={styles.overlay}
            >
                <Animated.View 
                    entering={ZoomIn} 
                    exiting={ZoomOut}
                    style={[styles.card, { backgroundColor: colors.surface }]}
                >
                    <View style={[
                        styles.iconCircle, 
                        isSuccess ? [styles.successIconBg, { backgroundColor: '#1DB954', shadowColor: '#1DB954' }] : 
                        type === 'warning' ? [styles.warningIconBg, { backgroundColor: colors.primary, shadowColor: colors.primary }] : [styles.deleteIconBg, { backgroundColor: '#EF4444', shadowColor: '#EF4444' }]
                    ]}>
                        {isSuccess ? (
                            <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                        ) : type === 'warning' ? (
                            <Feather name="alert-circle" size={32} color="#FFFFFF" />
                        ) : (
                            <Feather name="trash-2" size={28} color="#FFFFFF" />
                        )}
                    </View>

                    <Text style={[styles.title, { color: colors.heading }]}>{title}</Text>
                    <Text style={[styles.message, { color: colors.text }]}>{message}</Text>

                    {showFooter && (
                        <View style={styles.buttonRow}>
                            {onCancel && (
                                <TouchableOpacity 
                                    style={[styles.cancelBtn, { backgroundColor: colors.background }]} 
                                    onPress={onCancel}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.cancelBtnText, { color: colors.text }]}>{cancelText}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                style={[
                                    styles.confirmBtn, 
                                    isSuccess ? [styles.successBtn, { backgroundColor: colors.primary }] : 
                                    type === 'warning' ? [styles.confirmBtn, { backgroundColor: colors.primary }] : [styles.deleteBtn, { backgroundColor: '#EF4444' }]
                                ]} 
                                onPress={onConfirm}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.confirmBtnText}>{confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    successIconBg: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    deleteIconBg: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    warningIconBg: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    title: {
        fontSize: 20,
        fontFamily: Typography.h1,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        fontFamily: Typography.body,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8,
        paddingHorizontal: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontFamily: Typography.button,
    },
    confirmBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    successBtn: {
        // backgroundColor handled inline
    },
    deleteBtn: {
        // backgroundColor handled inline
    },
    confirmBtnText: {
        fontSize: 15,
        fontFamily: Typography.button,
        color: '#FFFFFF',
    },
});
