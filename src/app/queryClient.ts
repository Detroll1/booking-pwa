import {QueryClient} from '@tanstack/react-query';
import {ApiFailure} from '@/lib/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiFailure) {
          if (['network', 'not_configured'].includes(error.code)) return failureCount < 2;
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Owner-only caches must never survive a logout. */
export function clearPrivateCache(): void {
  queryClient.clear();
}
