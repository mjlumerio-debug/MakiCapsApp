import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import api from './api';

export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  contactNumber: string;
  role?: 'customer' | 'rider' | 'admin' | 'cashier';
  branchId?: number | null;
  branchName?: string | null;
  riderId?: number | null;
  avatarId?: number; // 1, 2, 3, or 4
  profilePictureUrl?: string | null;
};


type SignupPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  verificationProof: string;
  contactNumber: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RequestEmailVerificationResponse = {
  ok: boolean;
  message: string;
  sentTo?: string;
  delivery?: 'smtp';
};

type VerifyEmailCodeResponse = {
  ok: boolean;
  message: string;
  verificationProof: string;
  firstName?: string | null;
};

const mapAuthUser = (user: any, emailFallback = ''): AuthUser => ({
  id: user?.id || 0,
  firstName: user?.first_name || '',
  lastName: user?.last_name || '',
  name: user?.name || '',
  email: user?.email || emailFallback,
  contactNumber: user?.role === 'rider' ? (user?.phone || '') : (user?.mobile_number || ''),
  role: user?.role || 'customer',
  branchId: user?.branch_id || user?.branchId || null,
  branchName: user?.branch?.name || user?.branchName || user?.branch_name || null,
  riderId: user?.role === 'rider' ? user?.id : null,
  avatarId: user?.avatar_id || user?.avatarId || 1, 
  profilePictureUrl: user?.role === 'rider' ? null : (user?.profile_photo_path || null),
});

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  try {
    const response = await api.get('user');
    const resData = response.data?.data || response.data;
    // Handle nested user object if present (Laravel usually returns { user: {...} } or just {...})
    const userData = resData?.user || resData;
    return mapAuthUser(userData);
  } catch (error: any) {
    // Log the detailed error for debugging
    let role: any = 'customer';
    let phone: string = '';
    let name: string = 'Valued User';

    // 🛡️ RECOVERY LOGIC: Check for cached profile BEFORE logging big errors
    try {
      const cached = await AsyncStorage.getItem('user_profile');
      if (cached) {
        const profile = JSON.parse(cached);
        role = profile.role || 'customer';
        phone = profile.contactNumber || profile.phone || profile.mobile_number || '';
        name = profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Valued User';
        
        console.warn(`[AuthAPI] Server 500 on /user. Proceeding with local profile for: ${name}`);
        
        return {
          id: profile.id || 0,
          firstName: profile.firstName || name.split(' ')[0],
          lastName: profile.lastName || (name.split(' ')[1] || (role === 'rider' ? 'Rider' : 'User')),
          email: profile.email || '...',
          contactNumber: phone,
          role: role as any,
          avatarId: profile.avatarId || 1,
          profilePictureUrl: profile.profilePictureUrl || null
        };
      }
    } catch (e) {}

    // If we get here, it means we have NO local data, so we log the full error
    if (error.response) {
      console.error('[API-DEBUG] Profile Fetch Failed with Status:', error.response.status);
      console.error('[API-DEBUG] Response Data:', JSON.stringify(error.response.data));
    }

    throw error;
  }
};

/**
 * Refresh the auth token using the backend's token rotation endpoint.
 * The old token is revoked server-side and a new one is issued.
 */
export const refreshToken = async (): Promise<boolean> => {
  try {
    const currentToken = await SecureStore.getItemAsync('auth_token');
    if (!currentToken) return false;

    const response = await api.post('token/refresh');
    const newToken = response.data?.token;

    if (newToken) {
      await SecureStore.setItemAsync('auth_token', newToken);
      console.log('[Auth] Token refreshed successfully.');
      return true;
    }
    return false;
  } catch (error) {
    console.log('[Auth] Token refresh failed:', error instanceof Error ? error.message : error);
    return false;
  }
};

export const signupUser = async (payload: SignupPayload): Promise<AuthUser> => {
  try {
    const response = await api.post('register', {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      password: payload.password,
      password_confirmation: payload.password,
      mobile_number: payload.contactNumber,
      verification_proof: payload.verificationProof,
    });

    const resData = response.data?.data || response.data;
    const user = resData?.user || resData;
    const token = resData?.token || resData?.access_token;

    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    }

    return mapAuthUser(user, payload.email);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const msg = error.response.data?.message || error.response.data?.error || 'Signup failed.';
      throw new Error(msg);
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error('Network error, please check your connection.');
    }
    throw new Error('An unexpected error occurred during signup.');
  }
};

export const loginUser = async (payload: LoginPayload): Promise<AuthUser> => {
  try {
    const response = await api.post('login', {
      email: payload.email,
      password: payload.password,
    });

    const resData = response.data?.data || response.data;
    const user = resData?.user || resData;
    const token = resData?.token || resData?.access_token;

    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    }

    // Return the user from the login response directly
    // This avoids a race condition where fetchCurrentUser might fail if the token is still being persisted
    return mapAuthUser(user, payload.email);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        throw new Error('Invalid email or password.');
      }

      if (status === 403) {
        const forbiddenMsg = data?.message || data?.error || 'Access denied. Your account may require verification.';
        throw new Error(forbiddenMsg);
      }

      // Handle Laravel validation errors (422)
      if (status === 422 && data.errors) {
        const firstError = Object.values(data.errors)[0];
        if (Array.isArray(firstError) && firstError.length > 0) {
          throw new Error(firstError[0]);
        }
      }

      const msg = data?.message || data?.error || `Login failed (Status: ${status}).`;
      throw new Error(msg);
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error('Network error, please check your connection.');
    }
    throw new Error('An unexpected error occurred during login.');
  }
};

export const mobileLogin = async (payload: LoginPayload): Promise<AuthUser> => {
  try {
    // Specifically hit the mobile login endpoint
    const { getApiBaseUrl } = await import('./api');
    console.log('[DEBUG] Login URL:', `${getApiBaseUrl()}login`);
    console.log('[DEBUG] Request body:', JSON.stringify(payload));

    const response = await api.post('login', {
      email: payload.email,
      password: payload.password,
    });

    const resData = response.data?.data || response.data;
    const user = resData?.user || resData;
    const token = resData?.token || resData?.access_token;

    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    }

    const mappedUser = mapAuthUser(user, payload.email);

    // 🛡️ SECURITY: Immediately update the local cache for the new user
    await AsyncStorage.setItem('user_profile', JSON.stringify(mappedUser));
    await AsyncStorage.setItem('user_role', mappedUser.role || 'customer');

    if (mappedUser.role === 'rider') {
      // Automatically set status to available on login
      // Import updateRiderStatus dynamically to avoid circular dependencies if any
      const { updateRiderStatus } = await import('./rider_api');
      await updateRiderStatus('available');
    }

    return mappedUser;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        throw new Error('Invalid login details.');
      }

      if (status === 403) {
        // Handle "Account disabled" vs "Unauthorized access"
        const msg = data?.message || '';
        if (msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('inactive')) {
          throw new Error('Account disabled, contact admin.');
        }
        throw new Error('Unauthorized access.');
      }

      const msg = data?.message || data?.error || `Login failed (Status: ${status}).`;
      throw new Error(msg);
    }
    if (axios.isAxiosError(error) && !error.response) {
      console.error('[RiderLogin] Network Error:', error.message, error.config?.url);
      throw new Error(`Unable to connect (${error.message}). URL: ${error.config?.url}`);
    }
    throw new Error('An unexpected error occurred during rider login.');
  }
};

export const requestEmailVerificationCode = async (
  email: string
): Promise<RequestEmailVerificationResponse> => {
  try {
    const response = await api.post('verify-email/request', { email });
    return {
      ok: true,
      message: response.data.message || 'Verification code sent.',
      sentTo: response.data.sent_to || email,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const msg = error.response.data?.message || error.response.data?.error || 'Failed to send verification code.';
      throw new Error(msg);
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error('Network error, please check your connection.');
    }
    throw new Error('An unexpected error occurred.');
  }
};

export const verifyEmailCode = async (
  email: string,
  code: string
): Promise<VerifyEmailCodeResponse> => {
  try {
    const response = await api.post('verify-email/verify', { email, code });
    return {
      ok: true,
      message: response.data.message || 'Code verified.',
      verificationProof: response.data.verification_proof || response.data.token || '',
      firstName: response.data.first_name || null,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data;
      const msg = typeof data === 'string' ? data : (data?.message || data?.error || '');

      if (error.response.status === 422) {
        if (msg.toLowerCase().includes('expired')) {
          throw new Error('Verification code expired. Please request a new one.');
        }
        throw new Error('Invalid verification code.');
      }
      throw new Error(msg || 'Verification failed.');
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error('Network error, please check your connection.');
    }
    throw new Error('An unexpected error occurred.');
  }
};

export const requestPasswordReset = async (
  email: string
): Promise<RequestEmailVerificationResponse> => {
  try {
    const response = await api.post('verify-email/request', { email });
    return {
      ok: true,
      message: response.data.message || 'Reset code sent.',
      sentTo: response.data.sent_to || email,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const msg = error.response.data?.message || error.response.data?.error || 'Failed to send reset code.';
      throw new Error(msg);
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error('Network error, please check your connection.');
    }
    throw new Error('An unexpected error occurred.');
  }
};

export const changePassword = async (
  email: string,
  verificationProof: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> => {
  try {
    const response = await api.post('reset-password', {
      email,
      verification_proof: verificationProof,
      password: newPassword,
      password_confirmation: newPassword,
    });
    return {
      ok: true,
      message: response.data.message || 'Password changed successfully.',
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const msg = error.response.data?.message || error.response.data?.error || 'Failed to change password.';
      throw new Error(msg);
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error('Network error, please check your connection.');
    }
    throw new Error('An unexpected error occurred.');
  }
};

export const fetchUserFavorites = async (userId: number): Promise<string[]> => {
  try {
    const stored = await AsyncStorage.getItem(`favorites_${userId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const toggleUserFavorite = async (userId: number, foodId: string): Promise<void> => {
  try {
    const key = `favorites_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    let favorites: string[] = stored ? JSON.parse(stored) : [];

    if (favorites.includes(foodId)) {
      favorites = favorites.filter((id) => id !== foodId);
    } else {
      favorites.push(foodId);
    }

    await AsyncStorage.setItem(key, JSON.stringify(favorites));
  } catch (error) {
    console.error('Failed to toggle favorite', error);
  }
};

export type LinkPaymentResponse = {
  ok: boolean;
  message: string;
};

export const requestPaymentLink = async (
  type: string,
  accountName: string,
  accountNumber: string
): Promise<LinkPaymentResponse> => {
  const typeName = type === 'gcash' ? 'GCash' : 'PayMaya';

  // User requested any valid number should work for linking flow
  // We just simulate that all numbers are registered for this demo

  return {
    ok: true,
    message: `OTP sent to ${accountNumber}`,
  };
};

export const verifyPaymentOtp = async (
  type: string,
  accountNumber: string,
  otp: string
): Promise<LinkPaymentResponse> => {
  if (otp !== '123456') {
    throw new Error('Invalid OTP. Please enter 123456 for testing.');
  }
  return {
    ok: true,
    message: `${type.toUpperCase()} account successfully linked.`,
  };
};

/**
 * Update the user's profile information on the backend.
 * POST /profile/update (or similar endpoint)
 */
export const updateUserProfile = async (payload: { firstName: string; lastName: string; mobileNumber: string }): Promise<void> => {
  try {
    console.log('[AuthAPI] Updating profile:', payload);
    await api.post('profile/update', {
      first_name: payload.firstName,
      last_name: payload.lastName,
      mobile_number: payload.mobileNumber,
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const msg = error.response.data?.message || error.response.data?.error || 'Failed to update profile.';
      throw new Error(msg);
    }
    throw new Error('An unexpected error occurred while updating your profile.');
  }
};

/**
 * Change the user's password.
 * POST /profile/change-password
 */
export const updateProfilePassword = async (payload: any): Promise<void> => {
  try {
    await api.post('profile/change-password', payload);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.message || 'Failed to change password.');
    }
    throw error;
  }
};

/**
 * Permanently delete the user's account.
 * DELETE /profile/delete
 */
export const deleteAccount = async (): Promise<void> => {
  try {
    await api.delete('profile/delete');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.message || 'Failed to delete account.');
    }
    throw error;
  }
};
