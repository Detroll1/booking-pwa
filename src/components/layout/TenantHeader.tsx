import {Link, useParams} from 'react-router-dom';
import {Car, UserCircle} from '@phosphor-icons/react';
import {HStack} from '@astryxdesign/core/HStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useTenantContext} from '@/app/TenantContext';
import {ownerPath, tenantPath} from '@/lib/tenant/resolve';

/**
 * Compact studio header used on every client screen: logo + short name on the
 * left, account (owner) entry on the right. Matches the reference layout.
 */
export function TenantHeader() {
  const {tenant} = useTenantContext();
  const {slug = ''} = useParams();

  return (
    <header className="glass sticky top-0 z-30 border-b pt-safe">
      <HStack gap={3} vAlign="center" paddingInline={4} paddingBlock={3}>
        <Link to={tenantPath(slug)} className="flex items-center gap-2">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt="" className="h-8 w-8 rounded-lg border border-border object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tenant-accent text-white">
              <Car size={18} weight="fill" />
            </span>
          )}
          <Text type="body" weight="semibold">
            {tenant.name}
          </Text>
        </Link>
        <StackItem size="fill" />
        <Link to={ownerPath(slug, 'login')} aria-label="Кабинет владельца" className="text-secondary hover:text-primary">
          <UserCircle size={26} weight="duotone" />
        </Link>
      </HStack>
    </header>
  );
}
