import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

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
}: MakiModalProps) {
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
                    style={styles.card}
                >
                    <View style={[
                        styles.iconCircle, 
                        isSuccess ? styles.successIconBg : 
                        type === 'warning' ? styles.warningIconBg : styles.deleteIconBg
                    ]}>
                        {isSuccess ? (
                            <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                        ) : type === 'warning' ? (
                            <Feather name="alert-circle" size={32} color="#FFFFFF" />
                        ) : (
                            <Feather name="trash-2" size={28} color="#FFFFFF" />
                        )}
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonRow}>
                        {onCancel && (
                            <TouchableOpacity 
                                style={styles.cancelBtn} 
                                onPress={onCancel}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelBtnText}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            style={[styles.confirmBtn, isSuccess ? styles.successBtn : styles.deleteBtn]} 
                            onPress={onConfirm}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.confirmBtnText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#FFFFFF',
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
        backgroundColor: '#1DB954', // Vibrant Green
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    deleteIconBg: {
        backgroundColor: '#EF4444', // Red for delete
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    warningIconBg: {
        backgroundColor: '#FF9500', // Orange for warning
        shadowColor: '#FF9500',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2C2C2C',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
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
        backgroundColor: '#F5F5F5',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#8A8A8A',
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
        backgroundColor: '#D94F3D', // Branded Rich Red/Orange
    },
    deleteBtn: {
        backgroundColor: '#EF4444',
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
