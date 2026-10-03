import {useQuery} from '@tanstack/react-query';
import {fetchCatalog, type CatalogResponse} from '@/lib/api/public';
import {isSupabaseConfigured} from '@/lib/supabase/client';
import {demoMode} from '@/lib/api/client';

export const tenantQueryKey = (slug: string) => ['catalog', slug] as const;

export function useCatalog(slug: string | null) {
  return useQuery<CatalogResponse>({
    queryKey: tenantQueryKey(slug ?? 'none'),
    queryFn: ({signal}) => fetchCatalog(slug ?? '', signal),
    enabled: Boolean(slug) && (isSupabaseConfigured || demoMode()),
    staleTime: 60_000,
  });
}

export function useTenant(slug: string | null) {
  const query = useCatalog(slug);
  return {...query, tenant: query.data?.tenant ?? null};
}
