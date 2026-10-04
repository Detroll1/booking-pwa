import {useState} from 'react';
import {ArrowLeft, DeviceMobile, Desktop, DownloadSimple, Phone} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {useTenantContext} from '@/app/TenantContext';
import {TenantHeader} from '@/components/layout/TenantHeader';
import {cn} from '@/lib/utils';

type Platform = 'iphone' | 'android' | 'desktop';

const STEPS: Record<Platform, {title: string; lines: string[]}[]> = {
  iphone: [
    {title: '1. Откройте Safari', lines: ['Запустите браузер Safari и откройте ссылку на студию.']},
    {title: '2. Поделиться', lines: ['Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх) внизу экрана.']},
    {title: '3. На главный экран', lines: ['Выберите «На экран “Домой”» и нажмите «Добавить».']},
  ],
  android: [
    {title: '1. Откройте Chrome', lines: ['Откройте ссылку на студию в браузере Chrome.']},
    {title: '2. Меню', lines: ['Нажмите «⋮» (три точки) в правом верхнем углу.']},
    {title: '3. Установить приложение', lines: ['Выберите «Установить приложение» и подтвердите.']},
  ],
  desktop: [
    {title: '1. Откройте Chrome или Edge', lines: ['Откройте ссылку на студию.']},
    {title: '2. Значок установки', lines: ['Нажмите значок «Установить» в адресной строке (монитор со стрелкой).']},
    {title: '3. Подтвердите', lines: ['Нажмите «Установить». Приложение откроется в отдельном окне.']},
  ],
};

const TABS: {id: Platform; label: string; icon: typeof Phone}[] = [
  {id: 'iphone', label: 'iPhone / iPad', icon: Phone},
  {id: 'android', label: 'Android', icon: DeviceMobile},
  {id: 'desktop', label: 'Компьютер', icon: Desktop},
];

export function InstallPage() {
  const {tenant} = useTenantContext();
  const [platform, setPlatform] = useState<Platform>('iphone');

  return (
    <>
      <TenantHeader />
      <VStack gap={4} paddingInline={4} paddingBlockEnd={8}>
        <a href={`/s/${tenant.slug}/`} className="inline-flex items-center gap-1 text-secondary hover:text-primary">
          <ArrowLeft size={16} aria-hidden />
          <Text type="supporting" color="inherit">
            На главную
          </Text>
        </a>

        <VStack gap={3} align="center" className="rounded-3xl border border-border bg-surface p-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tenant-accent text-white">
            <DownloadSimple size={28} weight="bold" aria-hidden />
          </span>
          <VStack gap={1} align="center">
            <Heading level={1}>Добавьте студию на главный экран</Heading>
            <Text type="supporting" justify="center">
              Своя иконка на устройстве. Быстрый доступ к услугам и вашей записи.
            </Text>
          </VStack>
          <Text type="supporting">Несколько шагов в браузере — и готово</Text>
        </VStack>

        <VStack gap={3}>
          <Heading level={2}>Как установить</Heading>
          <HStack gap={1} className="rounded-full border border-border bg-surface p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlatform(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-2',
                    platform === tab.id ? 'bg-tenant-accent text-white' : 'text-secondary',
                  )}
                >
                  <Icon size={16} aria-hidden />
                  <Text type="supporting" color="inherit">
                    {tab.label}
                  </Text>
                </button>
              );
            })}
          </HStack>
          <VStack gap={3} className="rounded-2xl border border-border bg-surface p-4">
            {STEPS[platform].map((step) => (
              <VStack key={step.title} gap={0}>
                <Text type="body" weight="semibold">
                  {step.title}
                </Text>
                {step.lines.map((line) => (
                  <Text key={line} type="supporting">
                    {line}
                  </Text>
                ))}
              </VStack>
            ))}
          </VStack>
        </VStack>
      </VStack>
    </>
  );
}