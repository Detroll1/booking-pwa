import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ownerApi} from '@/lib/api/owner';
import {isSupabaseConfigured} from '@/lib/supabase/client';
import type {Session} from '@supabase/supabase-js';
import type {ApiCustomer} from '@/types/api';

function tokenOf(session: Session | null): string | null {
  return session?.access_token ?? null;
}

export function useOwnerMembership(slug: string, session: Session | null) {
  return useQuery({
    queryKey: ['owner', 'me', slug],
    queryFn: () => ownerApi.me(tokenOf(session)!, slug),
    enabled: Boolean(slug && session) && isSupabaseConfigured,
  });
}

export function useOwnerSchedule(slug: string, session: Session | null, from: string, to: string) {
  return useQuery({
    queryKey: ['owner', 'schedule', slug, from, to],
    queryFn: () => ownerApi.schedule(tokenOf(session)!, slug, from, to),
    enabled: Boolean(slug && session) && isSupabaseConfigured,
  });
}

export function useOwnerStats(slug: string, session: Session | null, from: string, to: string) {
  return useQuery({
    queryKey: ['owner', 'stats', slug, from, to],
    queryFn: () => ownerApi.stats(tokenOf(session)!, slug, from, to),
    enabled: Boolean(slug && session) && isSupabaseConfigured,
  });
}

export function useOwnerServices(slug: string, session: Session | null) {
  return useQuery({
    queryKey: ['owner', 'services', slug],
    queryFn: () => ownerApi.services(tokenOf(session)!, slug),
    enabled: Boolean(slug && session) && isSupabaseConfigured,
  });
}

export function useOwnerResources(slug: string, session: Session | null) {
  return useQuery({
    queryKey: ['owner', 'resources', slug],
    queryFn: () => ownerApi.resources(tokenOf(session)!, slug),
    enabled: Boolean(slug && session) && isSupabaseConfigured,
  });
}

function useInvalidateOwner(slug: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({queryKey: ['owner'], predicate: (q) => q.queryKey[2] === slug});
}

export function useSetStatus(slug: string, session: Session | null) {
  const invalidate = useInvalidateOwner(slug);
  return useMutation({
    mutationFn: ({bookingId, status}: {bookingId: string; status: string}) =>
      ownerApi.setStatus(tokenOf(session)!, slug, bookingId, status),
    onSuccess: invalidate,
  });
}

export function useOwnerReschedule(slug: string, session: Session | null) {
  const invalidate = useInvalidateOwner(slug);
  return useMutation({
    mutationFn: ({bookingId, startAt, idempotencyKey}: {bookingId: string; startAt: string; idempotencyKey: string}) =>
      ownerApi.reschedule(tokenOf(session)!, slug, bookingId, startAt, idempotencyKey),
    onSuccess: invalidate,
  });
}

export function useOwnerCancel(slug: string, session: Session | null) {
  const invalidate = useInvalidateOwner(slug);
  return useMutation({
    mutationFn: ({bookingId, reason}: {bookingId: string; reason: string}) =>
      ownerApi.cancel(tokenOf(session)!, slug, bookingId, reason),
    onSuccess: invalidate,
  });
}

export function useAddPayment(slug: string, session: Session | null) {
  const invalidate = useInvalidateOwner(slug);
  return useMutation({
    mutationFn: (input: {
      bookingId: string;
      amountMinor: number;
      kind: 'payment' | 'refund';
      method: string;
      idempotencyKey: string;
    }) => ownerApi.addPayment(tokenOf(session)!, slug, input.bookingId, input.amountMinor, input.kind, input.method, input.idempotencyKey),
    onSuccess: invalidate,
  });
}

export function useCreateOwnerBooking(slug: string, session: Session | null) {
  const invalidate = useInvalidateOwner(slug);
  return useMutation({
    mutationFn: (input: {
      serviceId: string;
      startAt: string;
      customer: ApiCustomer;
      idempotencyKey: string;
    }) => ownerApi.createBooking(tokenOf(session)!, slug, input),
    onSuccess: invalidate,
  });
}

export function useUpsertService(slug: string, session: Session | null) {
  const invalidate = useInvalidateOwner(slug);
  return useMutation({
    mutationFn: (service: Parameters<typeof ownerApi.upsertService>[2]) =>
      ownerApi.upsertService(tokenOf(session)!, slug, service),
    onSuccess: invalidate,
  });
}

export function useUpdateTenant(slug: string, session: Session | null) {
  const invalidate = useInvalidateOwner(slug);
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => ownerApi.updateTenant(tokenOf(session)!, slug, patch),
    onSuccess: invalidate,
  });
}
