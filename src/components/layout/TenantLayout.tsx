import {useEffect} from 'react';
import {Outlet, useLocation, useParams} from 'react-router-dom';
import {VStack} from '@astryxdesign/core/VStack';
import {useCatalog} from '@/hooks/useTenant';
import {isSupabaseConfigured} from '@/lib/supabase/client';
import {demoMode} from '@/lib/api/client';
import {TenantProvider} from '@/app/TenantContext';
import {AsyncBoundary, SupabaseNotConfigured} from '@/components/AsyncBoundary';
import {applyTenantTheme} from '@/lib/tenant/theme';
import {applyTenantMeta} from '@/lib/pwa/register';
import {isValidSlug} from '@/lib/tenant/resolve';
import {BottomNav} from './BottomNav';

export function TenantLayout() {
  const {slug} = useParams();
  const location = useLocation();
  const isOwner = /\/owner(\/|$)/.test(location.pathname);
  const validSlug = slug && isValidSlug(slug) ? slug : null;
  const query = useCatalog(validSlug);

  useEffect(() => {
    if (query.data?.tenant) {
      applyTenantTheme({accent: query.data.tenant.accent, surfaceImageUrl: query.data.tenant.heroImageUrl});
      applyTenantMeta({
        slug: validSlug ?? '',
        name: query.data.tenant.name,
        accent: query.data.tenant.accent,
        logoUrl: query.data.tenant.logoUrl,
      });
    }
  }, [query.data, validSlug]);

  if (!isSupabaseConfigured && !demoMode()) {
    return (
      <VStack gap={0} minHeight="100dvh">
        <SupabaseNotConfigured />
      </VStack>
    );
  }

  const error = validSlug ? query.error : new Error('Ссылка на студию неверна.');

  return (
    <VStack gap={0} minHeight="100dvh" className={isOwner ? 'pb-safe' : 'pb-nav'}>
      <AsyncBoundary isLoading={query.isLoading} error={error} onRetry={() => void query.refetch()}>
        {query.data && validSlug ? (
          <TenantProvider
            value={{
              slug: validSlug,
              tenant: query.data.tenant,
              services: query.data.services,
              works: query.data.works,
              serverTime: query.data.serverTime,
            }}
          >
            <Outlet />
          </TenantProvider>
        ) : null}
      </AsyncBoundary>
      {validSlug && !isOwner ? <BottomNav /> : null}
    </VStack>
  );
}
