import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BrandHeaderProps {
    brandName: string;
}

const BrandHeader: React.FC<BrandHeaderProps> = ({ brandName }) => {
    return (
        <View style={styles.container}>
            <View style={styles.left}>
                <Ionicons name="bag-handle-outline" size={16} color="#333" />
                <Text style={styles.brandName}>{brandName}</Text>
            </View>
            <TouchableOpacity>
                <Text style={styles.viewBrand}>view brand</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 15,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginLeft: 8,
    },
    viewBrand: {
        fontSize: 12,
        color: '#999',
    },
});

export default BrandHeader;
