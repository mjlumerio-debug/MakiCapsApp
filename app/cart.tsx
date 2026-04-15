import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import BrandHeader from '../components/cart/BrandHeader';
import CartFooter from '../components/cart/CartFooter';
import CartHeader from '../components/cart/CartHeader';
import CartItem from '../components/cart/CartItem';

// Mock Data
const CART_DATA = [
    {
        id: '1',
        brand: 'Scarlett',
        name: 'Scarlett Whitening',
        description: 'Brightly Serum',
        price: 10.3,
        quantity: 1,
        image: 'https://via.placeholder.com/150/F6D1DC/333?text=Serum', // Using placeholders as per standard practice when real assets aren't specified for new components
    },
    {
        id: '2',
        brand: 'Ponds',
        name: 'Ponds White Series',
        description: '4 Products',
        price: 21.93,
        quantity: 1,
        image: 'https://via.placeholder.com/150/F6D1DC/333?text=Ponds',
    },
    {
        id: '3',
        brand: 'Emina',
        name: 'Emina Bright Stuff',
        description: 'Face Serum',
        price: 11.56,
        quantity: 2,
        image: 'https://via.placeholder.com/150/F6D1DC/333?text=Emina',
    }
];

export default function CartScreen() {
    const router = useRouter();
    const total = 55.08; // Example total from the requirements
    const totalItems = 4; // 1+1+2 items

    const handleCheckout = () => {
        router.push('/checkout');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                {/* Main Card */}
                <View style={styles.card}>
                    <CartHeader />

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {CART_DATA.map((item, index) => (
                            <View key={item.id}>
                                <BrandHeader brandName={item.brand} />
                                <CartItem
                                    id={item.id}
                                    name={item.name}
                                    description={item.description}
                                    price={item.price}
                                    quantity={item.quantity}
                                    image={item.image}
                                />
                            </View>
                        ))}
                    </ScrollView>

                    <CartFooter total={total} itemCount={totalItems} onCheckout={handleCheckout} />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F6D1DC',
    },
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    card: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 25,
        // Soft shadow for the main container
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    scrollContent: {
        paddingBottom: 20,
    },
});
