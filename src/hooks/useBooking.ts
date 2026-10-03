import {useMutation} from '@tanstack/react-query';
import {
  cancelBookingByToken,
  createBooking,
  fetchBookingByToken,
  rescheduleBookingByToken,
  subscribeReminder,
  type CreateBookingInput,
} from '@/lib/api/public';
import {useQuery} from '@tanstack/react-query';
import {isSupabaseConfigured} from '@/lib/supabase/client';
import {demoMode} from '@/lib/api/client';

export function useCreateBooking() {
  return useMutation({
    mutationFn: (input: CreateBookingInput) => createBooking(input),
  });
}

export function bookingQueryKey(slug: string, token: string) {
  return ['booking', slug, token] as const;
}

export function useBookingByToken(slug: string | null, token: string | null) {
  return useQuery({
    queryKey: bookingQueryKey(slug ?? '', token ?? ''),
    queryFn: ({signal}) => fetchBookingByToken(slug ?? '', token ?? '', signal),
    enabled: Boolean(slug && token) && (isSupabaseConfigured || demoMode()),
  });
}

export function useCancelBooking() {
  return useMutation({
    mutationFn: ({slug, token, reason}: {slug: string; token: string; reason: string}) =>
      cancelBookingByToken(slug, token, reason),
  });
}

export function useRescheduleBooking() {
  return useMutation({
    mutationFn: ({
      slug,
      token,
      startAt,
      idempotencyKey,
    }: {
      slug: string;
      token: string;
      startAt: string;
      idempotencyKey: string;
    }) => rescheduleBookingByToken(slug, token, startAt, idempotencyKey),
  });
}

export function useSubscribeReminder() {
  return useMutation({
    mutationFn: ({slug, token, subscription}: {slug: string; token: string; subscription: unknown}) =>
      subscribeReminder(slug, token, subscription),
  });
}
