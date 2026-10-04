import {NavLink, useParams} from 'react-router-dom';
import {GridFour, House, CalendarCheck} from '@phosphor-icons/react';
import {Text} from '@astryxdesign/core/Text';
import {tenantPath} from '@/lib/tenant/resolve';
import {cn} from '@/lib/utils';

const ITEMS = [
  {to: '', label: 'Главная', icon: House, end: true},
  {to: 'services', label: 'Услуги', icon: GridFour, end: false},
  {to: 'booking', label: 'Моя запись', icon: CalendarCheck, end: false},
] as const;

/** Floating glass pill bottom navigation, matching the original design. */
export function BottomNav() {
  const {slug = ''} = useParams();
  return (
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-safe">
      <div className="glass mb-3 flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={tenantPath(slug, item.to)}
              end={item.end}
              className={({isActive}) =>
                cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-2 transition-colors',
                  isActive ? 'bg-tenant-accent text-white' : 'text-secondary hover:text-primary',
                )
              }
            >
              <Icon size={18} weight={undefined} aria-hidden />
              <Text type="supporting" color="inherit">
                {item.label}
              </Text>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
