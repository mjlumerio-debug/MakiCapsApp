import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CartHeaderProps {
    onBack?: () => void;
    onDelete?: () => void;
}

const CartHeader: React.FC<CartHeaderProps> = ({ onBack, onDelete }) => {
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    return (
        <View style={styles.header}>
            <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
                <Ionicons name="chevron-back" size={20} color="#333" />
            </TouchableOpacity>

            <Text style={styles.title}>Cart</Text>

            <TouchableOpacity style={styles.iconButton} onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color="#333" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 20,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        // Subtle shadow for the buttons
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
    },
});

export default CartHeader;
