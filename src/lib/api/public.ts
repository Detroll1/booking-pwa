import {callFunction} from './client';
import type {
  ApiAssistantReply,
  ApiAvailabilityResponse,
  ApiBooking,
  ApiCreateBookingResponse,
  ApiCustomer,
  ApiService,
  ApiTenant,
  ApiWork,
} from '@/types/api';

export interface CatalogResponse {
  tenant: ApiTenant;
  services: ApiService[];
  works: ApiWork[];
  serverTime: string;
}

export function fetchCatalog(slug: string, signal?: AbortSignal): Promise<CatalogResponse> {
  return callFunction<CatalogResponse>('catalog', {
    body: {slug, demo: demoFlag()},
    method: 'POST',
    signal,
  });
}

export function fetchAvailability(
  slug: string,
  serviceId: string,
  fromDate: string,
  days: number,
  signal?: AbortSignal,
): Promise<ApiAvailabilityResponse> {
  return callFunction<ApiAvailabilityResponse>('availability', {
    body: {slug, serviceId, fromDate, days, demo: demoFlag()},
    signal,
  });
}

export interface CreateBookingInput {
  slug: string;
  serviceId: string;
  startAt: string;
  customer: ApiCustomer;
  idempotencyKey: string;
  demo: boolean;
}

export function createBooking(input: CreateBookingInput, signal?: AbortSignal): Promise<ApiCreateBookingResponse> {
  return callFunction<ApiCreateBookingResponse>('bookings', {
    body: {action: 'create', ...input},
    signal,
  });
}

export function fetchBookingByToken(slug: string, token: string, signal?: AbortSignal): Promise<{booking: ApiBooking}> {
  return callFunction<{booking: ApiBooking}>('bookings', {
    body: {action: 'get', slug},
    bookingToken: token,
    signal,
  });
}

export function cancelBookingByToken(slug: string, token: string, reason: string): Promise<{booking: ApiBooking}> {
  return callFunction<{booking: ApiBooking}>('bookings', {
    body: {action: 'cancel', slug, reason},
    bookingToken: token,
  });
}

export function rescheduleBookingByToken(
  slug: string,
  token: string,
  startAt: string,
  idempotencyKey: string,
): Promise<{booking: ApiBooking}> {
  return callFunction<{booking: ApiBooking}>('bookings', {
    body: {action: 'reschedule', slug, startAt, idempotencyKey},
    bookingToken: token,
  });
}

export function subscribeReminder(slug: string, token: string, subscription: unknown): Promise<{ok: boolean}> {
  return callFunction<{ok: boolean}>('bookings', {
    body: {action: 'subscribe-push', slug, subscription},
    bookingToken: token,
  });
}

export interface AssistantQuestion {
  slug: string;
  scope: 'client';
  message: string;
  history: {role: 'user' | 'assistant'; content: string}[];
  accessToken?: string;
}

export function askClientAssistant(input: AssistantQuestion, signal?: AbortSignal): Promise<ApiAssistantReply> {
  return callFunction<ApiAssistantReply>('assistant', {body: input, signal});
}

export function demoFlag(): boolean {
  return import.meta.env.VITE_APP_ENV !== 'production';
}
