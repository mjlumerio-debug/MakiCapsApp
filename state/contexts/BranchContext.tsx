import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { branchInitialState, branchReducer, BranchState, BranchAction } from '../reducers/branchReducer';

const BranchContext = createContext<{
  state: BranchState;
  dispatch: React.Dispatch<BranchAction>;
} | undefined>(undefined);

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(branchReducer, branchInitialState);
  return (
    <BranchContext.Provider value={{ state, dispatch }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used within a BranchProvider');
  return context;
};
