import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CartItemProps {
    id: string;
    name: string;
    description: string;
    price: number;
    quantity: number;
    image: any; // Using local images or URLs
}

const CartItem: React.FC<CartItemProps> = ({ name, description, price, quantity, image }) => {
    return (
        <View style={styles.container}>
            {/* Product Image */}
            <View style={styles.imageContainer}>
                {typeof image === 'string' ? (
                    <Image source={{ uri: image }} style={styles.image} />
                ) : (
                    <Image source={image} style={styles.image} />
                )}
            </View>

            {/* Product Info */}
            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.description} numberOfLines={1}>{description}</Text>
                <View style={styles.priceContainer}>
                    <Text style={styles.currency}>$</Text>
                    <Text style={styles.price}>{price.toString().replace('.', ',')}</Text>
                </View>
            </View>

            {/* Quantity Controls */}
            <View style={styles.quantityContainer}>
                <TouchableOpacity style={styles.quantityButton}>
                    <Ionicons name="add" size={14} color="#999" />
                </TouchableOpacity>

                <Text style={styles.quantityText}>{quantity}</Text>

                <TouchableOpacity style={styles.quantityButton}>
                    <Ionicons name="remove" size={14} color="#999" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    imageContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        // Subtle shadow for the product image box
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 15,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    description: {
        fontSize: 13,
        color: '#999',
        marginBottom: 8,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    currency: {
        fontSize: 10,
        fontWeight: '700',
        color: '#333',
        marginTop: 2,
        marginRight: 2,
    },
    price: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    quantityContainer: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 5,
    },
    quantityButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    quantityText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E75480', // Matching pink theme
        marginVertical: 4,
    },
});

export default CartItem;
