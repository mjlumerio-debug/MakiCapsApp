import axios from 'axios';
import api from './api';
import { setRiderStatus } from './ui_store';

export type RiderOperationalStatus = 'available' | 'busy' | 'offline';

/**
 * Updates the rider's operational status on the backend.
 * Automatically synchronizes with the global UI store upon success.
 */
export const updateRiderStatus = async (status: RiderOperationalStatus): Promise<boolean> => {
  try {
    const response = await api.patch('rider/status', { status });
    if (response.status === 200) {
      setRiderStatus(status);
      return true;
    }
    return false;
  } catch (error: any) {
    if (error.response?.status !== 500) {
      console.error('[RiderAPI] Failed to update status:', error.response?.data || error.message);
    }
    return false;
  }
};

/**
 * Sends a heartbeat to the backend to keep the rider session active.
 * Should be called periodically (e.g., every 30-60 seconds).
 */
export const sendRiderHeartbeat = async (currentStatus: RiderOperationalStatus): Promise<boolean> => {
  try {
    const response = await api.post('rider/ping', {
      status: currentStatus,
    });
    
    // Sync status if the backend overrides it
    if (response.data && response.data.status && response.data.status !== currentStatus) {
      setRiderStatus(response.data.status as RiderOperationalStatus);
    }
    
    return response.status === 200;
  } catch (error) {
    // We don't want to spam the console for every failed heartbeat, 
    // but we can log it for debugging
    console.debug('[RiderAPI] Heartbeat failed:', error);
    return false;
  }
};

/**
 * Strict Rider Workflow Endpoints
 */

export const acceptOrder = async (orderId: number) => {
  const response = await api.post(`rider/orders/${orderId}/accept`);
  return response.data;
};

export const pickupOrder = async (orderId: number) => {
  const response = await api.post(`rider/orders/${orderId}/pickup`);
  return response.data;
};

export const transitOrder = async (orderId: number) => {
  const response = await api.post(`rider/orders/${orderId}/transit`);
  return response.data;
};

export const deliverOrder = async (orderId: number, photoUri: string) => {
  const formData = new FormData();
  
  // Create file object from uri
  const filename = photoUri.split('/').pop() || 'proof.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  formData.append('proof_of_delivery', {
    uri: photoUri,
    name: filename,
    type,
  } as any);

  const response = await api.post(`rider/orders/${orderId}/deliver`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const sendRiderLocation = async (latitude: number, longitude: number) => {
  try {
    const response = await api.post('rider/location', { latitude, longitude });
    return response.data;
  } catch (error) {
    console.debug('[RiderAPI] Location ping failed:', error);
    return null;
  }
};
