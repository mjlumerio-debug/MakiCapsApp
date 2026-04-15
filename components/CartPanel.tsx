import { useMenuStore } from '@/lib/menu_store';
import { clearCart, setCartCollapsed, toggleAllCartCheck, toggleCartCheck, updateCartQuantity, useUiStore, removeCheckedFromCart } from '@/lib/ui_store';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

type CartPanelProps = {
    bottomPadding: number;
    onCheckout: () => void;
};

const DELIVERY_FEE = 38.00;

function CartItemRow({ item, food }: { item: any; food: any }) {
    if (!food) return null;

    return (
        <View style={styles.itemCard}>
            <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => toggleCartCheck(item.id)}
            >
                <MaterialCommunityIcons
                    name={item.checked ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={24}
                    color={item.checked ? "#FF5800" : "#CCC"}
                />
            </TouchableOpacity>

            <Image source={food.image} style={styles.itemImage} resizeMode="cover" />

            <View style={styles.itemInfo}>
                <View>
                    <Text style={styles.itemTitle} numberOfLines={1}>{food.title}</Text>
                    <Text style={styles.itemDescription} numberOfLines={1}>
                        {food.description || 'Fresh ingredients'}
                    </Text>
                </View>

                <View style={styles.itemFooter}>
                    <Text style={styles.itemPrice}>{food.price}</Text>

                    <View style={styles.qtyRow}>
                        <TouchableOpacity
                            style={styles.qtyBtnMinus}
                            onPress={() => updateCartQuantity(item.id, item.quantity - 1)}
                        >
                            <Ionicons name="remove" size={14} color="#999" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity.toString().padStart(2, '0')}</Text>
                        <TouchableOpacity
                            style={styles.qtyBtnPlus}
                            onPress={() => updateCartQuantity(item.id, item.quantity + 1)}
                        >
                            <Ionicons name="add" size={14} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

export default function CartPanel({ bottomPadding, onCheckout }: CartPanelProps) {
    const { cartItems, isCartCollapsed } = useUiStore();
    const { menuItems } = useMenuStore();
    const [showClearCartModal, setShowClearCartModal] = useState(false);

    const checkedItems = useMemo(() => cartItems.filter(item => item.checked), [cartItems]);
    const allChecked = cartItems.length > 0 && checkedItems.length === cartItems.length;


    const subTotal = useMemo(() => {
        return checkedItems.reduce((acc, item) => {
            const food = menuItems.find(f => f.id === item.id);
            if (!food) return acc;
            // Handle both $ and ₱ symbols in price string
            const price = parseFloat(food.price.replace(/[^\d.]/g, ''));
            return acc + (price * item.quantity);
        }, 0);
    }, [checkedItems, menuItems]);

    const total = subTotal;

    const animatedStyle = useAnimatedStyle(() => {
        const isMin = isCartCollapsed;
        return {
            transform: [{
                translateY: withTiming(isMin ? 400 : 0, {
                    duration: 400,
                    easing: Easing.out(Easing.back(0.8))
                })
            }],
            opacity: withTiming(isMin ? 0 : 1, { duration: 300 })
        };
    });

    // Smooth padding transition for the list
    const paddingBottomAnim = useDerivedValue(() => {
        return withTiming(isCartCollapsed ? 0 : bottomPadding + 240, {
            duration: 350,
            easing: Easing.out(Easing.cubic)
        });
    });

    const listContainerStyle = useAnimatedStyle(() => ({
        paddingBottom: paddingBottomAnim.value
    }));

    const handleClearCart = () => {
        setShowClearCartModal(true);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>My Cart</Text>
                    {cartItems.length > 0 && (
                        <TouchableOpacity 
                            style={styles.selectAllRow} 
                            onPress={() => toggleAllCartCheck(!allChecked)}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons
                                name={allChecked ? "checkbox-marked" : "checkbox-blank-outline"}
                                size={20}
                                color={allChecked ? "#D94F3D" : "#999"}
                            />
                            <Text style={styles.selectAllText}>Select All</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.clearBtn} onPress={handleClearCart}>
                    <Ionicons name="trash-outline" size={22} color="#D94F3D" />
                </TouchableOpacity>
            </View>

            <Animated.View style={[{ flex: 1 }, listContainerStyle]}>
                <FlatList
                    data={cartItems}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <CartItemRow
                            item={item}
                            food={menuItems.find(f => f.id === item.id)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="cart-outline" size={64} color="#E0E0E0" />
                            <Text style={styles.emptyTitle}>Your cart is feeling light!</Text>
                            <Text style={styles.emptyText}>Time to add some delicious authentic Japanese flavors to your journey. 🍣</Text>
                        </View>
                    }
                />
            </Animated.View>

            {cartItems.length > 0 && (
                <>
                    <Animated.View style={[styles.summaryContainer, animatedStyle, { paddingBottom: bottomPadding + 35 }]}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setCartCollapsed(true)}
                            style={styles.handleWrapper}
                        >
                            <View style={styles.handle} />
                        </TouchableOpacity>

                        <View style={styles.summaryContent}>
                            <View style={styles.horizontalFooterBar}>
                                {/* Left: Total */}
                                <View>
                                    <Text style={styles.totalCountText}>Total ({checkedItems.length} {checkedItems.length === 1 ? 'item' : 'items'})</Text>
                                    <Text style={styles.totalPriceText}>₱{total.toFixed(2).split('.')[0]}<Text style={styles.decimalText}>.{total.toFixed(2).split('.')[1]}</Text></Text>
                                </View>

                                {/* Right: Check Out button */}
                                <TouchableOpacity
                                    style={[styles.checkoutBtnSmall, checkedItems.length === 0 && styles.disabledBtn]}
                                    onPress={onCheckout}
                                    disabled={checkedItems.length === 0}
                                >
                                    <Text style={styles.checkoutBtnText}>Check Out</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.footerDivider} />
                            <View style={styles.footerNote}>
                                <Ionicons name="lock-closed-outline" size={12} color="#9CA3AF" />
                                <Text style={styles.footerNoteText}>Secure checkout · Delivery fee applied at checkout</Text>
                            </View>
                        </View>
                    </Animated.View>

                    {isCartCollapsed && (
                        <TouchableOpacity
                            style={[styles.maximizeBtn, { bottom: 85 }]}
                            onPress={() => setCartCollapsed(false)}
                            activeOpacity={0.8}
                        >
                            <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }]}>
                                <Ionicons name="chevron-up" size={24} color="#FFF" />
                            </Animated.View>
                        </TouchableOpacity>
                    )}
                </>
            )}

            {/* Cozy Clear Cart Modal */}
            <Modal transparent visible={showClearCartModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Ionicons name="trash-outline" size={32} color="#D94F3D" />
                        </View>
                        <Text style={styles.modalTitle}>Clear Cart</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to remove all items from your cart? This action cannot be undone.</Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowClearCartModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.modalConfirmBtn} 
                                onPress={() => {
                                    clearCart();
                                    setShowClearCartModal(false);
                                }}
                            >
                                <Text style={styles.modalConfirmText}>Clear All</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingTop: 10,
        paddingBottom: 15,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#2C2C2C',
    },
    headerLeft: {
        flex: 1,
    },
    selectAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    selectAllText: {
        fontSize: 13,
        color: '#999',
        fontWeight: '500',
    },
    clearBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    listContent: {
        paddingHorizontal: 25,
        paddingTop: 5,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 25,
        padding: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 2,
    },
    checkboxContainer: {
        paddingRight: 10,
    },
    itemImage: {
        width: 85,
        height: 85,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
    },
    itemInfo: {
        flex: 1,
        paddingLeft: 12,
        height: 85,
        justifyContent: 'center',
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2C2C2C',
    },
    itemDescription: {
        fontSize: 12,
        color: '#9E9E9E',
        marginTop: 4,
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF5800',
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    qtyBtnMinus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#EEE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyBtnPlus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyText: {
        marginHorizontal: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#2C2C2C',
    },
    summaryContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        // Height will be determined by content + paddingBottom
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: -10 },
        shadowRadius: 20,
        elevation: 15,
        zIndex: 50,
    },
    handleWrapper: {
        width: '100%',
        paddingVertical: 15,
        alignItems: 'center',
    },
    handle: {
        width: 44,
        height: 4,
        backgroundColor: '#E6E6E6',
        borderRadius: 2,
    },
    maximizeBtn: {
        position: 'absolute',
        right: 25,
        width: 54,
        height: 54,
        backgroundColor: '#FF5800',
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF5800',
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 12,
        zIndex: 1000,
    },
    summaryContent: {
        paddingTop: 4,
        paddingHorizontal: 20,
        paddingBottom: 6,
    },
    footerDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginTop: 14,
        marginHorizontal: -20,
    },
    footerNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingTop: 5,
    },
    footerNoteText: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '400',
    },
    horizontalFooterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    deleteActionBtn: {
        paddingBottom: 4,
    },
    deleteText: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '500',
    },
    footerRightArea: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    totalInfoArea: {
        alignItems: 'flex-end',
    },
    totalCountText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    totalPriceText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1F2937',
        letterSpacing: -0.5,
    },
    decimalText: {
        fontSize: 18,
        fontWeight: '600',
    },
    checkoutBtnSmall: {
        backgroundColor: '#FF5800',
        paddingHorizontal: 36,
        paddingVertical: 12,
        borderRadius: 30,
        shadowColor: '#FF5800',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
    },
    checkoutBtnText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    disabledBtn: {
        backgroundColor: '#E5E7EB',
        shadowOpacity: 0,
        elevation: 0,
    },
    disabledText: {
        color: '#D1D5DB',
    },
    emptyState: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    emptyTitle: {
        marginTop: 20,
        fontSize: 20,
        fontWeight: '700',
        color: '#2C2C2C',
    },
    emptyText: {
        marginTop: 10,
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        lineHeight: 22,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: 32,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FDECEB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2C2C2C',
        marginBottom: 10,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        color: '#8A8A8A',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 30,
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    modalCancelBtn: {
        flex: 1,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2C2C2C',
    },
    modalConfirmBtn: {
        flex: 1,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#D94F3D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    }
});
