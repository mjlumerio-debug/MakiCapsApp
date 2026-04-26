import { useCallback } from 'react';
import { useLocation } from '@/state/contexts/LocationContext';
import { useBranch } from '@/state/contexts/BranchContext';
import { useCart } from '@/state/contexts/CartContext';
import { isAddressInServiceArea, type Address, type SelectedBranch, showGlobalAlert } from '@/lib/ui_store';
import { refreshMenuStore } from '@/lib/menu_store';
import { getDistanceKm } from '@/lib/google_location';
import api from '@/lib/api';
import { Alert } from 'react-native';

/**
 * PRODUCTION-GRADE LOCATION STATE ENGINE
 * Centralized logic for Location -> Branch -> Product sync
 */
export const useAppStateFlow = () => {
  const { state: location, dispatch: locationDispatch } = useLocation();
  const { state: branch, dispatch: branchDispatch } = useBranch();
  const { state: cart, dispatch: cartDispatch } = useCart();

  /**
   * RE-CALCULATE ENGINE
   * Implements a 2-phase update for "Instant" UI responsiveness.
   */
  const recalculateBranchAvailability = useCallback(async (
    lat: number, 
    lng: number, 
    serviceable: boolean
  ) => {
    // ⚡ PHASE 1: INSTANT LOCAL CALCULATION
    // Use the cached branch list to update UI immediately for a seamless feel.
    if (branch.availableBranches.length > 0) {
        const localProcessed = branch.availableBranches.map(b => {
            const distance = getDistanceKm(lat, lng, b.latitude!, b.longitude!);
            const isInRadius = distance <= (b.delivery_radius_km || 0);
            return {
                ...b,
                distance_km: distance,
                is_available: serviceable && isInRadius && b.status !== 'closed'
            };
        }).sort((a, b) => a.distance_km - b.distance_km);

        branchDispatch({ type: 'SET_BRANCHES', payload: localProcessed });
        
        const nearest = localProcessed.find(b => b.is_available);
        if (nearest && !branch.isManualSelection) {
            branchDispatch({ type: 'SET_BRANCH', payload: nearest });
            branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'branch' });
        } else if (!nearest) {
            branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'global' });
        }
    }

    // 🔄 PHASE 2: VERIFIED BACKGROUND REFRESH
    branchDispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // 1. Fetch All Branches (No stale cached data)
      const response = await api.get('branches', { params: { lat, lng } });
      const rawBranches = response.data?.data || response.data?.branches || [];

      const processedBranches: SelectedBranch[] = rawBranches.map((b: any) => {
        const bLat = Number(b.latitude);
        const bLng = Number(b.longitude);
        const radius = Number(b.delivery_radius_km || 0);
        const distance = getDistanceKm(lat, lng, bLat, bLng);
        const isInRadius = distance <= radius;
        const isOpen = b.status !== 'closed';

        return {
          id: Number(b.id),
          name: b.name || 'Branch',
          address: b.address || '',
          latitude: bLat,
          longitude: bLng,
          distance_km: distance,
          delivery_radius_km: radius,
          is_available: serviceable && isInRadius && isOpen,
          status: isOpen ? 'open' : 'closed',
          status_text: b.status_text || '',
        };
      }).sort((a: any, b: any) => a.distance_km - b.distance_km);

      branchDispatch({ type: 'SET_BRANCHES', payload: processedBranches });

      const nearestAvailable = processedBranches.find(b => b.is_available);

      if (nearestAvailable) {
        branchDispatch({ type: 'SET_RECOMMENDED_BRANCH', payload: nearestAvailable.id });
        branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'branch' });

        if (!branch.isManualSelection) {
          if (branch.selectedBranch && branch.selectedBranch.id !== nearestAvailable.id && cart.items.length > 0) {
            cartDispatch({ type: 'CLEAR_CART' });
            showGlobalAlert(
              "Location Changed", 
              "Your cart has been cleared because you moved to a different branch service area.",
              'out_of_range',
              () => require('expo-router').router.replace('/home_dashboard')
            );
          }
          branchDispatch({ type: 'SET_BRANCH', payload: nearestAvailable });
          await refreshMenuStore('branch', nearestAvailable.id);
        } else {
          const currentId = branch.selectedBranch?.id || nearestAvailable.id;
          await refreshMenuStore('branch', currentId);
        }
      } else {
        const previouslyHadBranch = !!branch.selectedBranch;
        branchDispatch({ type: 'SET_BRANCH', payload: null });
        branchDispatch({ type: 'SET_RECOMMENDED_BRANCH', payload: null });
        branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'global' });
        
        if (cart.items.length > 0) {
           cartDispatch({ type: 'CLEAR_CART' });
           if (previouslyHadBranch) {
             showGlobalAlert(
               "Outside Delivery Area", 
               "Your cart has been cleared because your current location is outside our delivery range.",
               'out_of_range',
               () => require('expo-router').router.replace('/home_dashboard')
             );
           }
        }
        await refreshMenuStore('global');
      }

    } catch (error) {
      console.error('[Engine] Background refresh failed:', error);
      branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'global' });
      await refreshMenuStore('global');
    } finally {
      branchDispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [branchDispatch, branch.isManualSelection, branch.selectedBranch, branch.availableBranches, cart.items.length, cartDispatch]);

  const setAddress = useCallback(async (address: Address | null) => {
    locationDispatch({ type: 'SET_ADDRESS', payload: address });
    
    if (!address) {
      branchDispatch({ type: 'SET_BRANCH', payload: null });
      branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'global' });
      await refreshMenuStore('global');
      return;
    }

    const serviceable = isAddressInServiceArea(address);
    locationDispatch({ type: 'SET_SERVICEABLE', payload: serviceable });

    const lat = Number(address.latitude);
    const lng = Number(address.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      await recalculateBranchAvailability(lat, lng, serviceable);
    } else {
      branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'global' });
      await refreshMenuStore('global');
    }
  }, [locationDispatch, branchDispatch, recalculateBranchAvailability]);

  const setBranch = useCallback(async (newBranch: SelectedBranch | null, isManual: boolean = true) => {
    const currentId = branch.selectedBranch?.id;
    const nextId = newBranch?.id;

    branchDispatch({ type: 'SET_BRANCH', payload: newBranch });
    branchDispatch({ type: 'SET_MANUAL_SELECTION', payload: isManual });

    if (newBranch) {
      branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'branch' });
      if (currentId && nextId && currentId !== nextId && cart.items.length > 0) {
        cartDispatch({ type: 'CLEAR_CART' });
        showGlobalAlert(
          "Branch Switched", 
          "Your cart has been cleared because you switched to a different branch.",
          'generic',
          () => require('expo-router').router.replace('/home_dashboard')
        );
      }
      if (nextId) {
        cartDispatch({ type: 'SET_BRANCH_ID', payload: nextId });
      }
      await refreshMenuStore('branch', nextId);
    } else {
      branchDispatch({ type: 'SET_CATALOG_MODE', payload: 'global' });
      await refreshMenuStore('global');
    }
  }, [branch.selectedBranch?.id, branchDispatch, cart.items.length, cartDispatch]);

  return { setAddress, setBranch };
};
