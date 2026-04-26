import { isAddressInServiceArea, setCartCollapsed, useUiStore } from '@/lib/ui_store';
import { useLocation } from '@/state/contexts/LocationContext';
import { useBranch } from '@/state/contexts/BranchContext';
import { useCart } from '@/state/contexts/CartContext';
import { getDistanceKm } from '@/lib/google_location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatPeso, resolveProductImage } from '@/lib/menu_store';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import StockLimitModal from './StockLimitModal';

type CartPanelProps = {
    bottomPadding: number;
    onCheckout: () => void;
};

function CartItemRow({ item, food, dispatch, colors, onStockLimit }: { item: any; food: any; dispatch: any; colors: any; onStockLimit: (max: number, inCart: number, name: string) => void }) {
    const displayFood = food || item;
    const name = displayFood.name || displayFood.title;
    if (!name) return null;
    
    const rawStock = displayFood.max_quantity ?? displayFood.stock;
    const hasStockLimit = rawStock != null && Number(rawStock) > 0;
    const maxQuantity = hasStockLimit ? Math.floor(Number(rawStock)) : Infinity;
    const displayPrice = displayFood.selling_price ? formatPeso(displayFood.selling_price) : displayFood.price;
    const displayImage = displayFood.image_path ? resolveProductImage(displayFood.image_path) : displayFood.image;

    return (
        <View style={[styles.itemCard, { backgroundColor: colors.surface, shadowColor: colors.primary }]}>
            <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => dispatch({ type: 'TOGGLE_CHECK', payload: item.id })}
            >
                <MaterialCommunityIcons
                    name={item.checked ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={24}
                    color={item.checked ? colors.primary : colors.text}
                />
            </TouchableOpacity>

            <Image 
                source={typeof displayImage === 'string' ? { uri: displayImage } : displayImage} 
                style={[styles.itemImage, { backgroundColor: colors.background }]} 
                resizeMode="cover" 
            />

            <View style={styles.itemInfo}>
                <View>
                    <Text style={[styles.itemTitle, { color: colors.heading }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.itemDescription, { color: colors.text }]} numberOfLines={1}>
                        {displayFood.description || 'Fresh ingredients'}
                    </Text>
                </View>

                <View style={styles.itemFooter}>
                    <Text style={[styles.itemPrice, { color: colors.primary }]}>{displayPrice}</Text>

                    <View style={styles.qtyRow}>
                        <TouchableOpacity
                            style={[styles.qtyBtnMinus, { borderColor: colors.primary }]}
                            onPress={() => {
                                if (item.quantity > 1) {
                                    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: item.id, quantity: item.quantity - 1 } });
                                } else {
                                    dispatch({ type: 'REMOVE_ITEM', payload: item.id });
                                }
                            }}
                        >
                            <Ionicons name="remove" size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={[styles.qtyText, { color: colors.heading }]}>{item.quantity.toString().padStart(2, '0')}</Text>
                        <TouchableOpacity
                            style={[styles.qtyBtnPlus, { backgroundColor: colors.primary }]}
                            onPress={() => {
                                if (!hasStockLimit || item.quantity < maxQuantity) {
                                    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: item.id, quantity: item.quantity + 1 } });
                                } else {
                                    onStockLimit(maxQuantity, item.quantity, name);
                                }
                            }}
                        >
                            <Ionicons name="add" size={14} color={colors.background} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

export default function CartPanel({ bottomPadding, onCheckout }: CartPanelProps) {
    const { colors, isDark } = useAppTheme();
    const { isCartCollapsed } = useUiStore();
    const { state: locationState } = useLocation();
    const { state: branchState } = useBranch();
    const { state: cartState, dispatch } = useCart();
    
    const { selectedAddress: activeAddress } = locationState;
    const { selectedBranch, catalogMode } = branchState;
    const { items: cartItems } = cartState;
    const isServiceable = useMemo(() => 
        isAddressInServiceArea(activeAddress),
        [activeAddress]
    );

    const isGlobalMode = catalogMode === 'global' || !isServiceable;

    const [showClearCartModal, setShowClearCartModal] = useState(false);
    const [stockLimitModal, setStockLimitModal] = useState<{ visible: boolean; maxQuantity: number; currentInCart: number; itemName: string }>({ visible: false, maxQuantity: 0, currentInCart: 0, itemName: '' });

    const checkedItems = useMemo(() => cartItems.filter(item => item.checked), [cartItems]);
    const allChecked = cartItems.length > 0 && checkedItems.length === cartItems.length;

    const distanceToBranch = useMemo(() => {
        if (!selectedBranch || !activeAddress?.latitude || !activeAddress?.longitude || !selectedBranch.latitude || !selectedBranch.longitude) return null;
        return getDistanceKm(
            activeAddress.latitude,
            activeAddress.longitude,
            selectedBranch.latitude,
            selectedBranch.longitude
        );
    }, [selectedBranch, activeAddress]);

    const isOutsideRadius = useMemo(() => {
        if (distanceToBranch === null || !selectedBranch?.delivery_radius_km) return false;
        return distanceToBranch > selectedBranch.delivery_radius_km;
    }, [distanceToBranch, selectedBranch]);


    const total = useMemo(() => {
        return checkedItems.reduce((acc, item) => {
            const price = parseFloat(String(item.price).replace(/[^\d.]/g, '')) || 0;
            return acc + (price * item.quantity);
        }, 0);
    }, [checkedItems]);

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
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.title, { color: colors.heading }]}>My Cart</Text>
                    {cartItems.length > 0 && (
                        <TouchableOpacity 
                            style={styles.selectAllRow} 
                            onPress={() => dispatch({ type: 'TOGGLE_ALL', payload: !allChecked })}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons
                                name={allChecked ? "checkbox-marked" : "checkbox-blank-outline"}
                                size={20}
                                color={allChecked ? colors.primary : colors.text}
                            />
                            <Text style={[styles.selectAllText, { color: colors.text }]}>Select All</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, shadowColor: colors.primary }]} onPress={handleClearCart}>
                    <Ionicons name="trash-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <Animated.View style={[{ flex: 1 }, listContainerStyle]}>
                <FlatList
                    data={cartItems}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <CartItemRow
                            item={item}
                            food={null}
                            dispatch={dispatch}
                            colors={colors}
                            onStockLimit={(max, inCart, name) => setStockLimitModal({ visible: true, maxQuantity: max, currentInCart: inCart, itemName: name })}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="cart-outline" size={64} color={colors.surface} />
                            <Text style={[styles.emptyTitle, { color: colors.heading }]}>Your cart is feeling light!</Text>
                            <Text style={[styles.emptyText, { color: colors.text }]}>Time to add some delicious authentic Japanese flavors to your journey. 🍣</Text>
                        </View>
                    }
                />
            </Animated.View>

            {cartItems.length > 0 && (
                <>
                    <Animated.View style={[styles.summaryContainer, animatedStyle, { backgroundColor: colors.surface, shadowColor: colors.primary, paddingBottom: bottomPadding + 35 }]}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setCartCollapsed(true)}
                            style={styles.handleWrapper}
                        >
                            <View style={[styles.handle, { backgroundColor: colors.primary }]} />
                        </TouchableOpacity>

                        <View style={styles.summaryContent}>
                            <View style={styles.checkoutSection}>
                                {isGlobalMode && (
                                    <View style={[styles.globalModeWarning, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                                        <Ionicons name="information-circle" size={16} color={colors.primary} />
                                        <Text style={[styles.globalModeWarningText, { color: colors.heading }]}>
                                            Select a delivery address within service area to proceed
                                        </Text>
                                    </View>
                                )}
                                
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={[
                                        styles.checkoutButton, 
                                        { backgroundColor: colors.primary },
                                        (checkedItems.length === 0 || isGlobalMode) && styles.checkoutButtonDisabled
                                    ]}
                                    onPress={() => !isGlobalMode && onCheckout()}
                                    disabled={checkedItems.length === 0 || isGlobalMode}
                                >
                                    <Text style={[styles.checkoutText, { color: colors.background }]}>
                                        {isGlobalMode ? (catalogMode === 'global' ? 'Choose Branch' : 'Unavailable Area') : `Checkout (\u20B1${total.toFixed(2)})`}
                                    </Text>
                                    {!isGlobalMode && <Ionicons name="arrow-forward" size={18} color={colors.background} />}
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.footerDivider, { backgroundColor: colors.primary }]} />
                            <View style={styles.footerNote}>
                                <Ionicons name="lock-closed-outline" size={12} color={colors.text} />
                                <Text style={[styles.footerNoteText, { color: colors.text }]}>Secure checkout · Delivery fee applied at checkout</Text>
                            </View>
                        </View>
                    </Animated.View>

                    {isCartCollapsed && (
                        <TouchableOpacity
                            style={[styles.maximizeBtn, { bottom: bottomPadding + 10, backgroundColor: colors.primary, shadowColor: colors.primary }]}
                            onPress={() => setCartCollapsed(false)}
                            activeOpacity={0.8}
                        >
                            <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }]}>
                                <Ionicons name="chevron-up" size={24} color={colors.background} />
                            </Animated.View>
                        </TouchableOpacity>
                    )}
                </>
            )}

            <Modal transparent visible={showClearCartModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface, shadowColor: colors.primary }]}>
                        <View style={[styles.modalIconBox, { backgroundColor: colors.background }]}>
                            <Ionicons name="trash-outline" size={32} color={colors.primary} />
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.heading }]}>Clear Cart</Text>
                        <Text style={[styles.modalMessage, { color: colors.text }]}>Are you sure you want to remove all items from your cart? This action cannot be undone.</Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: colors.background }]} onPress={() => setShowClearCartModal(false)}>
                                <Text style={[styles.modalCancelText, { color: colors.heading }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]} 
                                onPress={() => {
                                    dispatch({ type: 'CLEAR_CART' });
                                    setShowClearCartModal(false);
                                }}
                            >
                                <Text style={[styles.modalConfirmText, { color: colors.background }]}>Clear All</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <StockLimitModal
                visible={stockLimitModal.visible}
                onClose={() => setStockLimitModal(prev => ({ ...prev, visible: false }))}
                maxQuantity={stockLimitModal.maxQuantity}
                currentInCart={stockLimitModal.currentInCart}
                itemName={stockLimitModal.itemName}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FBEAD6', // 60% Champagne
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
        color: '#4A2C35', // Heading Mauve
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
        color: '#7A5560', // Body Mauve
        fontWeight: '500',
    },
    clearBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#D38C9D', // Blush
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#D38C9D',
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
        backgroundColor: '#D38C9D', // Blush
        borderRadius: 25,
        padding: 12,
        marginBottom: 16,
        shadowColor: '#D38C9D',
        shadowOpacity: 0.1,
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
        backgroundColor: '#FBEAD6', // Champagne
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
        color: '#4A2C35', // Heading Mauve
    },
    itemDescription: {
        fontSize: 12,
        color: '#7A5560', // Body Mauve
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
        color: '#D38C9D', // Antique Rose
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    qtyBtnMinus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#D38C9D', // Antique Rose
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyBtnPlus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#D38C9D', // Antique Rose
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyText: {
        marginHorizontal: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#4A2C35', // Mauve
    },
    summaryContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#D38C9D', // 30% Blush
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        shadowColor: '#D38C9D',
        shadowOpacity: 0.15,
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
        backgroundColor: '#D38C9D', // Antique Rose
        borderRadius: 2,
    },
    maximizeBtn: {
        position: 'absolute',
        right: 25,
        width: 54,
        height: 54,
        backgroundColor: '#D38C9D', // Antique Rose
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#D38C9D',
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
        backgroundColor: '#D38C9D', // Antique Rose
        marginTop: 14,
        marginHorizontal: -20,
        opacity: 0.2,
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
        color: '#7A5560', // Body Mauve
        fontWeight: '400',
    },
    checkoutSection: {
        paddingVertical: 4,
    },
    checkoutButton: {
        backgroundColor: '#D38C9D', // Antique Rose
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    checkoutButtonDisabled: {
        backgroundColor: '#D38C9D', // Blush
        opacity: 0.5,
    },
    checkoutText: {
        color: '#FBEAD6', // Champagne
        fontSize: 16,
        fontWeight: '700',
    },
    globalModeWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FBEAD6', // Champagne
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: '#D38C9D',
    },
    globalModeWarningText: {
        color: '#4A2C35', // Mauve
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
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
        color: '#4A2C35', // Heading Mauve
    },
    emptyText: {
        marginTop: 10,
        fontSize: 14,
        color: '#7A5560', // Body Mauve
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
        backgroundColor: '#FBEAD6', // Champagne
        borderRadius: 32,
        padding: 32,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#D38C9D',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#D38C9D', // Blush
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#4A2C35', // Heading Mauve
        marginBottom: 10,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        color: '#7A5560', // Body Mauve
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
        backgroundColor: '#D38C9D', // Blush
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4A2C35', // Mauve
    },
    modalConfirmBtn: {
        flex: 1,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#D38C9D', // Antique Rose
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FBEAD6', // Champagne
    },
    outsideWarning: {
        fontSize: 10,
        color: '#D38C9D', // Using Accent for warnings to be on theme
        fontWeight: '700',
        marginBottom: 4,
        textTransform: 'uppercase',
    }
});
