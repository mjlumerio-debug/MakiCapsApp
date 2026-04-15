import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapView = React.forwardRef(({ children, style, ...props }: any, ref) => (
    <View style={[style, styles.webMapContainer]} {...props}>
        <Text style={styles.webMapText}>Map is not supported on web natively.</Text>
        <Text style={styles.webMapSubtext}>Please use the mobile app or emulator.</Text>
        {children}
    </View>
));
MapView.displayName = 'MapView';

export const Marker = ({ children, ...props }: any) => <View {...props}>{children}</View>;

const styles = StyleSheet.create({
    webMapContainer: {
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    webMapText: {
        color: '#4B5563',
        fontWeight: '700',
        fontSize: 16,
    },
    webMapSubtext: {
        color: '#6B7280',
        fontSize: 13,
        marginTop: 4,
    }
});
