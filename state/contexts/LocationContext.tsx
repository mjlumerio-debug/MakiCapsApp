import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { locationInitialState, locationReducer, LocationState, LocationAction } from '../reducers/locationReducer';

const LocationContext = createContext<{
  state: LocationState;
  dispatch: React.Dispatch<LocationAction>;
} | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(locationReducer, locationInitialState);
  return (
    <LocationContext.Provider value={{ state, dispatch }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within a LocationProvider');
  return context;
};
