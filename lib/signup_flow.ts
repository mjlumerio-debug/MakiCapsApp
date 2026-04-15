type PendingSignup = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  contactNumber: string;
};

let pendingSignup: PendingSignup | null = null;

export const setPendingSignup = (payload: PendingSignup): void => {
  pendingSignup = payload;
};

export const getPendingSignup = (): PendingSignup | null => pendingSignup;

export const clearPendingSignup = (): void => {
  pendingSignup = null;
};

