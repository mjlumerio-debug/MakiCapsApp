/**
 * Realtime system disabled for stability.
 * Replaced with API-driven refresh strategy.
 */
export const initRealtime = () => {
  // Realtime connection disabled to prevent 'constructor is not callable' errors
  console.log('[Realtime] Disabled - Using stable API refresh system');
  return null;
};
