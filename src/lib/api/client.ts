import {isSupabaseConfigured} from '@/lib/supabase/client';
import {demoReply} from '@/lib/demo/mock';

/** True when the demo build has no backend and mocked functions should answer. */
export function demoMode(): boolean {
  if (import.meta.env.VITE_DEMO === 'true') return true;
  if ((window as unknown as {__FORCE_FALLBACK?: boolean}).__FORCE_FALLBACK === true) return true;
  try {
    return new URLSearchParams(window.location.search).get('fallback') === '1';
  } catch {
    return false;
  }
}

export interface ApiErrorBody {
  error?: {code?: string; message?: string; details?: unknown};
}

export class ApiFailure extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, code = 'unknown', status = 0, details?: unknown) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface CallOptions {
  body?: unknown;
  /** Owner Supabase access token; required for owner endpoints. */
  accessToken?: string;
  /** Booking access token; required for customer record endpoints. */
  bookingToken?: string;
  signal?: AbortSignal;
  method?: 'POST' | 'GET';
}

const baseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** Invoke a Supabase Edge Function with normalized error handling. */
export async function callFunction<T>(name: string, options: CallOptions = {}): Promise<T> {
  if (demoMode()) return demoReply<T>(name, options);
  if (!isSupabaseConfigured) {
    throw new ApiFailure('Supabase не настроен. См. SETUP.md.', 'not_configured');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${options.accessToken ?? anonKey}`,
  };
  if (options.bookingToken) headers['x-booking-token'] = options.bookingToken;

  const method = options.method ?? 'POST';
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method,
      headers,
      signal: options.signal,
      body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
    });
  } catch (cause) {
    throw new ApiFailure('Сеть недоступна. Проверьте соединение и повторите.', 'network', 0, cause);
  }

  const text = await response.text();
  const parsed: unknown = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    const errorBody = parsed as ApiErrorBody | null;
    const error = errorBody?.error;
    throw new ApiFailure(
      error?.message ?? `Запрос не выполнен (${response.status})`,
      error?.code ?? 'http_error',
      response.status,
      error?.details,
    );
  }
  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {raw: text};
  }
}
