import { CONFIG } from '../domain/config';

// Transport state for DevPanel simulation
let isSimulatedOffline: boolean = false;
let simulatedLatencyMs: number = CONFIG.DEFAULT_NETWORK_LATENCY_MS;

type TransportListener = (offline: boolean) => void;
const transportListeners: Set<TransportListener> = new Set();

export function setSimulatedOffline(offline: boolean) {
  isSimulatedOffline = offline;
  transportListeners.forEach((fn) => fn(offline));
}

export function getSimulatedOffline(): boolean {
  return isSimulatedOffline;
}

export function setSimulatedLatency(ms: number) {
  simulatedLatencyMs = Math.max(0, ms);
}

export function getSimulatedLatency(): number {
  return simulatedLatencyMs;
}

export function subscribeTransportStatus(listener: TransportListener): () => void {
  transportListeners.add(listener);
  return () => transportListeners.delete(listener);
}

export interface TransportResponse<T = any> {
  data?: T;
  status: number;
  ok: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/** Hard timeout so a stalled connection becomes a retryable network error instead of hanging the sync engine. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Transport: calls the Vercel `/api` backend.
 * Network failures (offline, timeout, HTML error pages from a missing backend) resolve to status 0 / NETWORK_ERROR,
 * which the offline sync engine treats as "retry later" rather than as a rejected record.
 */
export async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<TransportResponse<T>> {
  const networkError: TransportResponse<T> = {
    status: 0,
    ok: false,
    error: { code: 'NETWORK_ERROR', message: 'ارتباط با سرور برقرار نشد (خطای شبکه یا آفلاین).' },
  };

  // Browser offline or simulated offline (dev panel)
  if (isSimulatedOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return networkError;
  }

  if (simulatedLatencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    if (!isJson) return networkError; // no backend behind /api (e.g. `vite` without `vercel dev`)

    const payload = await res.json();
    if (res.ok) return { status: res.status, ok: true, data: payload as T };
    return {
      status: res.status,
      ok: false,
      error: {
        code: payload?.error?.code || 'INTERNAL_ERROR',
        message: payload?.error?.message || 'خطای سرور رخ داد.',
      },
    };
  } catch {
    return networkError;
  } finally {
    clearTimeout(timer);
  }
}
