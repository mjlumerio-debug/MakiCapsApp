import { type Address } from '@/lib/ui_store';

export type LocationState = {
  selectedAddress: Address | null;
  isLocationLoading: boolean;
  isServiceable: boolean;
};

export type LocationAction =
  | { type: 'SET_ADDRESS'; payload: Address | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SERVICEABLE'; payload: boolean };

export const locationInitialState: LocationState = {
  selectedAddress: null,
  isLocationLoading: false,
  isServiceable: false,
};

export const locationReducer = (state: LocationState, action: LocationAction): LocationState => {
  switch (action.type) {
    case 'SET_ADDRESS':
      return { ...state, selectedAddress: action.payload };
    case 'SET_LOADING':
      return { ...state, isLocationLoading: action.payload };
    case 'SET_SERVICEABLE':
      return { ...state, isServiceable: action.payload };
    default:
      return state;
  }
};
