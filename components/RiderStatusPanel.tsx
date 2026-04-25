import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUiStore } from '@/lib/ui_store';
import { updateRiderStatus, sendRiderHeartbeat } from '@/lib/rider_api';
import { Colors, Typography } from '@/constants/theme';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export const RiderStatusPanel = () => {
  const { riderStatus, sessionStatus } = useUiStore();
  const { colors, isDark } = useAppTheme();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('user_profile').then(data => {
      if (data) {
        try {
          const profile = JSON.parse(data);
          setUserRole(profile.role);
        } catch (e) {}
      }
    });
  }, [sessionStatus]);

  // Heartbeat mechanism
  useEffect(() => {
    // Only send heartbeats if the rider is authenticated, is actually a rider, and not explicitly offline
    if (userRole === 'rider' && sessionStatus === 'authorized' && riderStatus !== 'offline') {
      
      // Send immediate heartbeat on start
      sendRiderHeartbeat(riderStatus);

      // Setup interval (every 60 seconds)
      heartbeatTimer.current = setInterval(() => {
        sendRiderHeartbeat(riderStatus);
      }, 60000);
    }

    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
    };
  }, [riderStatus, sessionStatus, userRole]);

  const handleToggleOnline = async (value: boolean) => {
    const newStatus = value ? 'available' : 'offline';
    
    // Optimistic UI update could go here, but waiting for API is safer
    const success = await updateRiderStatus(newStatus);
    if (!success) {
      Alert.alert('Status Update Failed', 'Could not change your status. Please check your connection and try again.');
    }
  };

  const getStatusColor = () => {
    switch (riderStatus) {
      case 'available': return '#2ecc71'; // Green
      case 'busy': return '#f39c12';      // Orange
      case 'offline': return '#95a5a6';   // Gray
      default: return colors.text;
    }
  };

  const getStatusText = () => {
    switch (riderStatus) {
      case 'available': return 'Online & Ready';
      case 'busy': return 'On Delivery';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  if (sessionStatus !== 'authorized' || userRole !== 'rider') return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: colors.primary }]}>
      <View style={styles.statusInfo}>
        <View style={[styles.indicator, { backgroundColor: getStatusColor() }]} />
        <View>
          <Text style={[styles.statusText, { color: colors.heading }]}>
            {getStatusText()}
          </Text>
          {riderStatus === 'busy' && (
            <Text style={[styles.subText, { color: colors.text }]}>
              Completing active order...
            </Text>
          )}
        </View>
      </View>

      {/* Only allow manual toggle between available and offline. 
          'busy' state is usually handled automatically when accepting an order */}
      <View style={styles.toggleContainer}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>
          {riderStatus !== 'offline' ? 'Go Offline' : 'Go Online'}
        </Text>
        <Switch
          value={riderStatus !== 'offline'}
          onValueChange={handleToggleOnline}
          disabled={riderStatus === 'busy'} // Prevent toggling while delivering
          trackColor={{ false: '#bdc3c7', true: '#2ecc71' }}
          thumbColor={'#ffffff'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  statusText: {
    fontFamily: Typography.button,
    fontSize: 16,
    fontWeight: 'bold',
  },
  subText: {
    fontFamily: Typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontFamily: Typography.body,
    fontSize: 13,
    marginRight: 8,
  },
});
