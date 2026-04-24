import EchoModule from 'laravel-echo';
import PusherModule from 'pusher-js';
import { refreshMenuStore } from '@/lib/menu_store';
import { PRODUCTION_API_BASE_URL } from '@/lib/api';

// Robust CommonJS / ESM interop for React Native (Metro)
const resolveConstructor = (moduleDef: any): any => {
  if (typeof moduleDef === 'function') return moduleDef;
  if (typeof moduleDef?.default === 'function') return moduleDef.default;
  if (typeof moduleDef?.default?.default === 'function') return moduleDef.default.default;
  return moduleDef;
};

const PusherClass = resolveConstructor(PusherModule);
const EchoClass = resolveConstructor(EchoModule);

// We need to type the global Pusher for Echo
(window as any).Pusher = PusherClass;

let echoInstance: any = null;

export const initRealtime = () => {
  if (echoInstance) return echoInstance;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_BASE_URL;
  const parsedUrl = new URL(apiUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  const host = parsedUrl.hostname || 'makidesuoperation.site';

  if (!PusherClass || !EchoClass) {
    console.warn('Real-time dependencies are not available.');
    return null;
  }

  try {
    echoInstance = new EchoClass({
      broadcaster: 'reverb',
      key: 'makicaps_reverb_key',
      wsHost: host,
      wsPort: isHttps ? 443 : 8080,
      forceTLS: isHttps,
      enabledTransports: ['ws', 'wss'],
    });
  } catch (err) {
    console.warn('Failed to initialize real-time updates:', err);
    return null;
  }

  // Listen for Product & Stock updates
  echoInstance.channel('catalog')
    .listen('.ProductUpdated', async (e: any) => {
      console.log('Product updated real-time:', e);
      await refreshMenuStore();
    })
    .listen('.StockUpdated', async (e: any) => {
      console.log('Stock updated real-time:', e);
      await refreshMenuStore();
    });

  // Listen for Category updates
  echoInstance.channel('global')
    .listen('.CategoryUpdated', async (e: any) => {
      console.log('Category updated real-time:', e);
      await refreshMenuStore();
    });

  return echoInstance;
};
