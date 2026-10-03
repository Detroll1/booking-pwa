import {callFunction} from './client';
import type {ApiBooking, ApiCustomer, ApiNotificationJob, ApiStats} from '@/types/api';

export interface OwnerMembership {
  tenantId: string;
  tenantSlug: string;
  role: 'owner' | 'manager';
}

export interface OwnerService {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  resourceKind: string | null;
  isActive: boolean;
  sort: number;
}

export interface OwnerResource {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
  sort: number;
}

export interface OwnerDaySchedule {
  date: string;
  isClosed: boolean;
  startMin: number | null;
  endMin: number | null;
  bookings: ApiBooking[];
}

async function ownerCall<T>(accessToken: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return callFunction<T>('owner', {body: {action, ...payload}, accessToken});
}

export const ownerApi = {
  me: (token: string, slug: string) => ownerCall<{membership: OwnerMembership}>(token, 'me', {slug}),
  schedule: (token: string, slug: string, from: string, to: string) =>
    ownerCall<{days: OwnerDaySchedule[]; timezone: string}>(token, 'schedule', {slug, from, to}),
  bookings: (token: string, slug: string, from: string, to: string, status?: string) =>
    ownerCall<{bookings: ApiBooking[]}>(token, 'bookings', {slug, from, to, status}),
  stats: (token: string, slug: string, from: string, to: string) =>
    ownerCall<{stats: ApiStats}>(token, 'stats', {slug, from, to}),
  services: (token: string, slug: string) => ownerCall<{services: OwnerService[]}>(token, 'services', {slug}),
  resources: (token: string, slug: string) => ownerCall<{resources: OwnerResource[]}>(token, 'resources', {slug}),
  upsertService: (token: string, slug: string, service: Partial<OwnerService> & {id?: string}) =>
    ownerCall<{service: OwnerService}>(token, 'upsert-service', {slug, service}),
  deleteService: (token: string, slug: string, id: string) => ownerCall<{ok: true}>(token, 'delete-service', {slug, id}),
  createBooking: (
    token: string,
    slug: string,
    input: {serviceId: string; startAt: string; customer: ApiCustomer; idempotencyKey: string},
  ) => ownerCall<{booking: ApiBooking}>(token, 'create-booking', {slug, ...input}),
  reschedule: (token: string, slug: string, bookingId: string, startAt: string, idempotencyKey: string) =>
    ownerCall<{booking: ApiBooking}>(token, 'reschedule', {slug, bookingId, startAt, idempotencyKey}),
  cancel: (token: string, slug: string, bookingId: string, reason: string) =>
    ownerCall<{booking: ApiBooking}>(token, 'cancel', {slug, bookingId, reason}),
  setStatus: (token: string, slug: string, bookingId: string, status: string) =>
    ownerCall<{booking: ApiBooking}>(token, 'set-status', {slug, bookingId, status}),
  addPayment: (
    token: string,
    slug: string,
    bookingId: string,
    amountMinor: number,
    kind: 'payment' | 'refund',
    method: string,
    idempotencyKey: string,
  ) => ownerCall<{ok: true}>(token, 'add-payment', {slug, bookingId, amountMinor, kind, method, idempotencyKey}),
  setHours: (
    token: string,
    slug: string,
    hours: {weekday: number; windows: {startMin: number; endMin: number}[]}[],
  ) => ownerCall<{ok: true}>(token, 'set-hours', {slug, hours}),
  deleteMedia: (token: string, slug: string, id: string) => ownerCall<{ok: true}>(token, 'delete-media', {slug, id}),
  reorderMedia: (token: string, slug: string, order: {id: string; sort: number}[]) =>
    ownerCall<{ok: true}>(token, 'reorder-media', {slug, order}),
  updateTenant: (token: string, slug: string, patch: Record<string, unknown>) =>
    ownerCall<{ok: true}>(token, 'update-tenant', {slug, patch}),
  jobs: (token: string, slug: string) => ownerCall<{jobs: ApiNotificationJob[]}>(token, 'jobs', {slug}),
  hours: (token: string, slug: string) =>
    ownerCall<{hours: {weekday: number; windows: {startMin: number; endMin: number}[]}[]}>(token, 'hours', {slug}),
  media: (token: string, slug: string) =>
    ownerCall<{tenantId: string; works: {id: string; imageUrl: string; caption: string | null; sort: number; storagePath: string}[]}>(
      token,
      'media',
      {slug},
    ),
  upsertMedia: (
    token: string,
    slug: string,
    work: {id?: string; storagePath: string; imageUrl?: string; caption?: string | null; sort?: number},
  ) => ownerCall<{ok: true}>(token, 'upsert-media', {slug, work}),
};
