import {useEffect} from 'react';
import {NavLink, Outlet, useLocation, useNavigate, useParams} from 'react-router-dom';
import {CalendarDots, ChartBar, Images, Gear, Scissors, SignOut, ListChecks} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useAuth} from '@/hooks/useAuth';
import {OwnerSessionProvider} from '@/app/OwnerSessionContext';
import {AssistantSheet} from '@/components/assistant/AssistantSheet';
import {ownerPath} from '@/lib/tenant/resolve';
import {cn} from '@/lib/utils';

const TABS = [
  {to: 'schedule', label: 'Расписание', icon: CalendarDots},
  {to: 'bookings', label: 'Записи', icon: ListChecks},
  {to: 'services', label: 'Услуги', icon: Scissors},
  {to: 'media', label: 'Фото', icon: Images},
  {to: 'stats', label: 'Итоги', icon: ChartBar},
  {to: 'settings', label: 'Настройки', icon: Gear},
] as const;

export function OwnerLayout() {
  const {slug = ''} = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {session, isLoading, signOut} = useAuth();
  const isLogin = location.pathname.endsWith('/login');

  useEffect(() => {
    if (!isLoading && !session && !isLogin) {
      void navigate(ownerPath(slug, 'login'), {replace: true});
    }
  }, [isLoading, session, isLogin, navigate, slug]);

  if (isLogin) return <Outlet />;

  if (isLoading || !session) {
    return (
      <VStack minHeight="100dvh" padding={4}>
        <AsyncBoundary isLoading={isLoading} />
      </VStack>
    );
  }

  return (
    <OwnerSessionProvider value={{slug, session}}>
      <VStack gap={0} minHeight="100dvh" className="pb-nav">
        <VStack gap={3} padding={4} paddingBlockEnd={2}>
          <HStack hAlign="between" vAlign="center" gap={2}>
            <VStack gap={0}>
              <Heading level={1}>Кабинет студии</Heading>
              <Text type="supporting">{session.user.email}</Text>
            </VStack>
            <HStack gap={1} vAlign="center">
              <AssistantSheet slug={slug} scope="owner" accessToken={session.access_token} />
              <Button
                label="Выйти"
                variant="ghost"
                size="sm"
                icon={<SignOut size={16} />}
                onClick={() => void signOut()}
              />
            </HStack>
          </HStack>
          <HStack gap={2} isScrollable>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={ownerPath(slug, tab.to)}
                  className={({isActive}) =>
                    cn(
                      'flex shrink-0 items-center gap-2 rounded-full border px-3 py-2',
                      isActive ? 'border-tenant-accent tenant-accent-soft text-tenant-accent' : 'border-border bg-surface text-secondary',
                    )
                  }
                >
                  <Icon size={18} weight="duotone" aria-hidden />
                  <Text type="supporting" color="inherit">
                    {tab.label}
                  </Text>
                </NavLink>
              );
            })}
          </HStack>
        </VStack>
        <VStack gap={4} padding={4} paddingBlockEnd={8}>
          <Outlet />
        </VStack>
      </VStack>
    </OwnerSessionProvider>
  );
}
