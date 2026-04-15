import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple store and persistence for resend timers
type TimerStore = {
    [email: string]: number; // timestamp in ms
};

const TIMER_STORAGE_KEY = 'maki_resend_timers';
let timers: TimerStore = {};
let isLoaded = false;

// Load timers from AsyncStorage on first use
const ensureLoaded = async () => {
    if (isLoaded) return;
    try {
        const stored = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
        if (stored) {
            timers = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load timers', e);
    }
    isLoaded = true;
};

export const setLastResendTimestamp = async (email: string, timestamp: number) => {
    timers[email] = timestamp;
    try {
        await AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timers));
    } catch (e) {
        console.error('Failed to save timers', e);
    }
};

export const getRemainingCooldown = (email: string, cooldownMs: number): number => {
    // Return from memory cache for "fast" immediate initialization
    const lastSent = timers[email];
    if (!lastSent) return 0;

    const diff = Date.now() - lastSent;
    if (diff < cooldownMs) {
        return Math.ceil((cooldownMs - diff) / 1000);
    }
    return 0;
};

// Initial load trigger
ensureLoaded();
