import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/state/contexts/ThemeContext';
import { Typography } from '@/constants/theme';
import { useUiStore, logoutUser } from '@/lib/ui_store';
import { useRouter } from 'expo-router';

export function RiderProfilePanel() {
  const { colors } = useAppTheme();
  const { user } = useUiStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logoutUser();
    router.replace('/login');
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Rider Info Header */}
      <View style={styles.header}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '10' }]}>
          <Feather name="user" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.name, { color: colors.heading }]}>{user?.firstName || 'Rider Partner'}</Text>
        <Text style={[styles.role, { color: colors.text, opacity: 0.6 }]}>Professional Delivery Partner</Text>
      </View>

      {/* Information Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
        
        <InfoRow 
            icon="user" 
            label="Full Name" 
            value={user?.firstName || '---'} 
            colors={colors} 
        />
        <InfoRow 
            icon="mail" 
            label="Email Address" 
            value={user?.email || '---'} 
            colors={colors} 
        />
        <InfoRow 
            icon="phone" 
            label="Mobile Number" 
            value={user?.contactNumber || '---'} 
            colors={colors} 
        />
        
        {!!user?.branchName && (
            <InfoRow 
                icon="map-pin" 
                label="Assigned Branch" 
                value={user.branchName} 
                colors={colors} 
                isHighlight
            />
        )}
      </View>

      {/* Rider Specific Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Rider Tools</Text>
        
        <MenuButton 
          icon="list" 
          title="Delivery History" 
          onPress={() => {}} 
          colors={colors} 
        />
        <MenuButton 
          icon="dollar-sign" 
          title="Earnings & Payouts" 
          onPress={() => {}} 
          colors={colors} 
        />
        <MenuButton 
          icon="settings" 
          title="App Settings" 
          onPress={() => {}} 
          colors={colors} 
        />
      </View>

      {/* Logout Button */}
      <TouchableOpacity 
        style={[styles.logoutButton, { borderColor: colors.primary + '30' }]} 
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={colors.primary} />
        <Text style={[styles.logoutText, { color: colors.primary }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, colors, isHighlight }: any) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border + '10' }]}>
      <View style={[styles.iconBox, { backgroundColor: isHighlight ? colors.primary + '10' : 'transparent' }]}>
        <Feather name={icon} size={16} color={isHighlight ? colors.primary : colors.text} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.text, opacity: 0.5 }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: isHighlight ? colors.primary : colors.heading }]}>{value}</Text>
      </View>
    </View>
  );
}

function MenuButton({ icon, title, onPress, colors }: any) {
  return (
    <TouchableOpacity style={[styles.menuButton, { backgroundColor: colors.surface }]} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Feather name={icon} size={18} color={colors.primary} />
        <Text style={[styles.menuTitle, { color: colors.heading }]}>{title}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.text} opacity={0.3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontFamily: Typography.h2,
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    fontFamily: Typography.body,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Typography.button,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    opacity: 0.6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: Typography.body,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: Typography.h2,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontFamily: Typography.h2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: Typography.button,
    fontWeight: '600',
  },
});
