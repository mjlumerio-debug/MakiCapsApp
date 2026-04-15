import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

type RequestJsonConfig = {
  timeoutMs?: number;
  retryOnHttp5xx?: boolean;
};

// 1. Core Config
const API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT || 4000);
const DEFAULT_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 7000);

// 2. Utility Functions
const extractHost = (raw: string): string => {
  const input = String(raw || '').trim();
  if (!input) return '';
  // host[:port] format
  if (!input.includes('://')) {
    return input.split('/')[0].split(':')[0].trim();
  }
  try {
    return new URL(input).hostname.trim();
  } catch {
    return '';
  }
};

const isTunnel = (host: string): boolean =>
  host.includes('.exp.direct') ||
  host.includes('.expo-proxy.net') ||
  host.includes('.loca.lt') ||
  host.includes('.ngrok');

const buildUrl = (host: string): string => {
  const clean = host.trim();
  if (!clean) return '';
  // If it's already a full URL or a tunnel, use as is (or with http prefix)
  if (clean.includes('://') || isTunnel(clean)) {
    return clean.startsWith('http') ? clean : `http://${clean}`;
  }
  // Otherwise, it's a raw IP/hostname, so append port 4000
  return `http://${clean}:${API_PORT}`;
};

// 3. Robust Host Detection
const getDetectedHosts = (): string[] => {
  const hosts = new Set<string>();

  // Environment overrides (manual)
  if (process.env.EXPO_PUBLIC_API_URL) hosts.add(extractHost(process.env.EXPO_PUBLIC_API_URL));
  if (process.env.EXPO_PUBLIC_API_BASE_URL) hosts.add(extractHost(process.env.EXPO_PUBLIC_API_BASE_URL));

  // Auto-detect from Expo's own connection (THE MAGIC PART)
  try {
    const hostUri = Constants.expoConfig?.hostUri || '';
    if (hostUri) hosts.add(extractHost(hostUri));
  } catch { }

  try {
    const dbgHost = (Constants as any).expoGoConfig?.debuggerHost || '';
    if (dbgHost) hosts.add(extractHost(dbgHost));
  } catch { }

  try {
    const scriptUrl = (NativeModules as any).SourceCode?.scriptURL || '';
    if (scriptUrl) hosts.add(extractHost(scriptUrl));
  } catch { }

  return Array.from(hosts).filter(h => h && h !== 'localhost' && h !== '127.0.0.1');
};

const buildApiCandidates = (): string[] => {
  const candidates = new Set<string>();

  // 1. Prioritize detected LAN/Tunnel hosts
  getDetectedHosts().forEach(h => candidates.add(buildUrl(h)));

  // 2. Fallbacks
  if (Platform.OS === 'android') {
    candidates.add(`http://10.0.2.2:${API_PORT}`); // Emulator
  }
  candidates.add(`http://localhost:${API_PORT}`);
  candidates.add(`http://127.0.0.1:${API_PORT}`);

  return Array.from(candidates).filter(url => /^https?:\/\//i.test(url));
};

// 4. Client State
const API_CANDIDATES = buildApiCandidates();
let activeApiBaseUrl = API_CANDIDATES[0] || `http://localhost:${API_PORT}`;

export class HttpStatusError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  config?: RequestJsonConfig
): Promise<T> => {
  const timeoutMs = config?.timeoutMs || DEFAULT_TIMEOUT_MS;
  const candidates = [activeApiBaseUrl, ...API_CANDIDATES.filter(u => u !== activeApiBaseUrl)];
  let lastError: any = null;

  for (const baseUrl of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const normalizedBase = baseUrl.replace(/\/+$/, '');

    try {
      const response = await fetch(`${normalizedBase}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...init,
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = `Error ${response.status}`;
        try { msg = JSON.parse(text).message || text; } catch { }
        throw new HttpStatusError(response.status, msg);
      }

      activeApiBaseUrl = baseUrl;
      return (await response.json()) as T;
    } catch (e) {
      if (e instanceof HttpStatusError) throw e;
      lastError = e;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Connection failed. Tried: ${candidates.join(', ')}. Details: ${lastError?.message || lastError}`);
};

export const getApiBaseUrl = () => activeApiBaseUrl;
export const getApiCandidates = () => API_CANDIDATES;
