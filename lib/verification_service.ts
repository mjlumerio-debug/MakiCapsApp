import axios from 'axios';
import api from './api';

export interface VerificationResponse {
  success: boolean;
  message: string;
}

/**
 * Requests a 6-digit verification code to be sent to the user's email.
 * POST /verify-email/request
 */
export const requestEmailVerification = async (email: string): Promise<VerificationResponse> => {
  try {
    const response = await api.post('/verify-email/request', { email });
    return {
      success: true,
      message: response.data.message || 'Verification code sent successfully.'
    };
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Verifies the 6-digit code entered by the user.
 * POST /verify-email/verify
 */
export const verifyEmailCode = async (email: string, code: string): Promise<VerificationResponse> => {
  try {
    const response = await api.post('/verify-email/verify', { email, code });
    return {
      success: true,
      message: response.data.message || 'Email verified successfully.'
    };
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Standardized error handling for verification API requests.
 */
const handleApiError = (error: any): VerificationResponse => {
  if (axios.isAxiosError(error)) {
    // Handle specific status codes
    if (error.response?.status === 422) {
      const data = error.response.data;
      const message = typeof data === 'string' ? data : (data?.message || data?.error || '');

      if (message.toLowerCase().includes('expired')) {
        return { success: false, message: 'Verification code expired' };
      }
      
      // Default for 422 if not expired is usually invalid code
      return { success: false, message: 'Invalid verification code' };
    }

    // Handle network errors
    if (!error.response) {
      return { success: false, message: 'Network error, please try again' };
    }
  }

  // Handle unexpected errors
  return { success: false, message: 'An unexpected error occurred. Please try again.' };
};
