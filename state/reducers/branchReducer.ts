import { type SelectedBranch } from '@/lib/ui_store';

export type CatalogMode = 'branch' | 'global';

export type BranchState = {
  selectedBranch: SelectedBranch | null;
  recommendedBranchId: number | null;
  isManualSelection: boolean;
  catalogMode: CatalogMode;
  availableBranches: SelectedBranch[];
  isLoading: boolean;
};

export type BranchAction =
  | { type: 'SET_BRANCH'; payload: SelectedBranch | null }
  | { type: 'SET_RECOMMENDED_BRANCH'; payload: number | null }
  | { type: 'SET_MANUAL_SELECTION'; payload: boolean }
  | { type: 'SET_CATALOG_MODE'; payload: CatalogMode }
  | { type: 'SET_BRANCHES'; payload: SelectedBranch[] }
  | { type: 'SET_LOADING'; payload: boolean };

export const branchInitialState: BranchState = {
  selectedBranch: null,
  recommendedBranchId: null,
  isManualSelection: false,
  catalogMode: 'global',
  availableBranches: [],
  isLoading: false,
};

export const branchReducer = (state: BranchState, action: BranchAction): BranchState => {
  switch (action.type) {
    case 'SET_BRANCH':
      return { ...state, selectedBranch: action.payload };
    case 'SET_RECOMMENDED_BRANCH':
      return { ...state, recommendedBranchId: action.payload };
    case 'SET_MANUAL_SELECTION':
      return { ...state, isManualSelection: action.payload };
    case 'SET_CATALOG_MODE':
      return { ...state, catalogMode: action.payload };
    case 'SET_BRANCHES':
      return { ...state, availableBranches: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};
