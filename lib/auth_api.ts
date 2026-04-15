import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import api from './api';

type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
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

export const signupUser = async (payload: SignupPayload): Promise<AuthUser> => {
  try {
    const response = await api.post('/register', {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      password: payload.password,
      password_confirmation: payload.password,
      mobile_number: payload.contactNumber,
      verification_proof: payload.verificationProof,
    });

    const data = response.data;
    const user = data.user || data;

    return {
      id: user.id || 0,
      firstName: user.first_name || payload.firstName,
      lastName: user.last_name || payload.lastName,
      email: user.email || payload.email,
      contactNumber: user.mobile_number || payload.contactNumber,
    };
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
    const response = await api.post('/login', {
      email: payload.email,
      password: payload.password,
    });

    const data = response.data;
    const user = data.user || data;
    const token = data.token || data.access_token;

    // Store the auth token for future authenticated requests
    if (token) {
      await AsyncStorage.setItem('auth_token', token);
    }

    return {
      id: user.id || 0,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || payload.email,
      contactNumber: user.mobile_number || '',
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      if (status === 401) {
        throw new Error('Invalid email or password.');
      }
      const msg = error.response.data?.message || error.response.data?.error || 'Login failed.';
      throw new Error(msg);
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error('Network error, please check your connection.');
    }
    throw new Error('An unexpected error occurred during login.');
  }
};

export const requestEmailVerificationCode = async (
  email: string
): Promise<RequestEmailVerificationResponse> => {
  try {
    const response = await api.post('/verify-email/request', { email });
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
    const response = await api.post('/verify-email/verify', { email, code });
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
    const response = await api.post('/verify-email/request', { email });
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
    const response = await api.post('/reset-password', {
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
    await api.post('/profile/update', {
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
