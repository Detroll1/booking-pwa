import {useQuery} from '@tanstack/react-query';
import {fetchAvailability} from '@/lib/api/public';
import {isSupabaseConfigured} from '@/lib/supabase/client';
import {demoMode} from '@/lib/api/client';

export function availabilityQueryKey(slug: string, serviceId: string, fromDate: string, days: number) {
  return ['availability', slug, serviceId, fromDate, days] as const;
}

export function useAvailability(slug: string | null, serviceId: string | null, fromDate: string, days = 14) {
  return useQuery({
    queryKey: availabilityQueryKey(slug ?? '', serviceId ?? '', fromDate, days),
    queryFn: ({signal}) => fetchAvailability(slug ?? '', serviceId ?? '', fromDate, days, signal),
    enabled: Boolean(slug && serviceId) && (isSupabaseConfigured || demoMode()),
    staleTime: 15_000,
  });
}
