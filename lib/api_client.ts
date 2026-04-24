import { getApiBaseUrl } from './api';

type RequestJsonConfig = {
  timeoutMs?: number;
  retryOnHttp5xx?: boolean;
};

const DEFAULT_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 7000);
const API_BASE_URL = getApiBaseUrl();

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const normalizedBase = API_BASE_URL.replace(/\/+$/, '');
  const shouldRetryOn5xx = config?.retryOnHttp5xx ?? false;

  const execute = async (): Promise<T> => {
    const response = await fetch(`${normalizedBase}${path}`, {
      ...init,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let msg = `Error ${response.status}`;
      try {
        msg = JSON.parse(text).message || text;
      } catch {
        // no-op: keep fallback msg
      }
      throw new HttpStatusError(response.status, msg);
    }

    return (await response.json()) as T;
  };

  try {
    return await execute();
  } catch (e) {
    if (
      shouldRetryOn5xx &&
      e instanceof HttpStatusError &&
      e.status >= 500 &&
      e.status < 600
    ) {
      return execute();
    }
    if (e instanceof HttpStatusError) {
      throw e;
    }
    throw new Error(`Connection failed: ${String((e as any)?.message || e)}`);
  } finally {
    clearTimeout(timeout);
  }
};

export { getApiBaseUrl };
