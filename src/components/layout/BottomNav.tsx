import {NavLink, useParams} from 'react-router-dom';
import {House, GridFour, Ticket} from '@phosphor-icons/react';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {tenantPath} from '@/lib/tenant/resolve';
import {cn} from '@/lib/utils';

const ITEMS = [
  {to: '', label: 'Главная', icon: House, end: true},
  {to: 'services', label: 'Услуги', icon: GridFour, end: false},
  {to: 'booking', label: 'Моя запись', icon: Ticket, end: false},
] as const;

/**
 * Glass bottom navigation. It is position:fixed and the page adds matching
 * bottom padding (pb-nav) so content is never hidden behind it. Height is
 * exposed as --bottom-nav-height for safe-area math.
 */
export function BottomNav() {
  const {slug = ''} = useParams();
  return (
    <nav aria-label="Основная навигация" className="glass fixed inset-x-0 bottom-0 z-40 border-t pb-safe">
      <HStack gap={0} hAlign="evenly" paddingInline={2} minHeight={72} paddingBlockStart={2}>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={tenantPath(slug, item.to)}
              end={item.end}
              className={({isActive}) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 transition-colors',
                  isActive ? 'text-tenant-accent' : 'text-secondary hover:text-primary',
                )
              }
            >
              <Icon size={24} weight="duotone" aria-hidden />
              <Text type="supporting" color="inherit">
                {item.label}
              </Text>
            </NavLink>
          );
        })}
      </HStack>
    </nav>
  );
}
