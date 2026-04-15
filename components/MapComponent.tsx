import React, { forwardRef } from 'react';
import RNMapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MapViewProps } from 'react-native-maps';

/**
 * MapView wrapper that forces Google Maps on both iOS and Android.
 * Uses forwardRef so mapRef.current?.animateToRegion() works correctly.
 */
const MapView = forwardRef<RNMapView, MapViewProps & { children?: React.ReactNode }>(
    (props, ref) => (
        <RNMapView
            ref={ref}
            provider={PROVIDER_GOOGLE}
            {...props}
        />
    )
);

MapView.displayName = 'MapView';

export { MapView, Marker };
export type { RNMapView as MapViewInstance };
