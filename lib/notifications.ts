import * as Haptics from 'expo-haptics';
import { getUiStoreSnapshot, markAsRead } from './ui_store';

/**
 * PRODUCTION-GRADE NOTIFICATION ENGINE
 * Handles foreground and prepares for background notification logic.
 */
export const notifyOrderStatusChange = (orderId: string, status: string, type: 'transit' | 'delivered' | 'placed') => {
    const state = getUiStoreSnapshot();
    
    // Safety check: Only notify if user is logged in
    if (!state.userId) return;

    const notifId = `${orderId}-${type}`;
    
    // If already read, don't re-notify
    if (state.readNotificationIds.includes(notifId)) return;

    // Trigger physical feedback (vibration/ping)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    console.log(`[Notification] ${type.toUpperCase()} for order #${orderId}`);
    
    // Note: To support "App Closed" notifications, expo-notifications MUST be installed
    // and a background task registered. 
};
