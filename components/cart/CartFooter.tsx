import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CartFooterProps {
    total: number;
    itemCount: number;
    onCheckout?: () => void;
}

const CartFooter: React.FC<CartFooterProps> = ({ total, itemCount, onCheckout }) => {
    return (
        <View style={styles.container}>
            <View style={styles.priceSection}>
                <Text style={styles.label}>Amount Price</Text>
                <View style={styles.totalContainer}>
                    <Text style={styles.currency}>$</Text>
                    <Text style={styles.total}>{total.toString().replace('.', ',')}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.checkoutButton} onPress={onCheckout}>
                <Text style={styles.checkoutText}>Check Out</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{itemCount}</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 20,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#EAEAEA',
    },
    priceSection: {
        justifyContent: 'center',
    },
    label: {
        fontSize: 14,
        color: '#999',
        marginBottom: 4,
    },
    totalContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    currency: {
        fontSize: 12,
        fontWeight: '700',
        color: '#333',
        marginTop: 4,
        marginRight: 2,
    },
    total: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
    },
    checkoutButton: {
        backgroundColor: '#E75480',
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#E75480',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    checkoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 10,
    },
    badge: {
        backgroundColor: '#fff',
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#E75480',
        fontSize: 12,
        fontWeight: '700',
    },
});

export default CartFooter;
