import type {ReactNode} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Spinner} from '@astryxdesign/core/Spinner';
import {ApiFailure} from '@/lib/api/client';

export interface AsyncBoundaryProps {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyHint?: string;
  children?: ReactNode;
  onRetry?: () => void;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiFailure) return error.message;
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка';
}

/**
 * Every networked screen renders exactly one of loading | error | empty | success,
 * so this boundary is shared instead of being re-implemented per page.
 */
export function AsyncBoundary({
  isLoading = false,
  error = null,
  isEmpty = false,
  loadingLabel = 'Загрузка…',
  emptyTitle = 'Здесь пока пусто',
  emptyHint,
  children,
  onRetry,
}: AsyncBoundaryProps) {
  if (isLoading) {
    return (
      <VStack gap={3} align="center" padding={8} role="status" aria-live="polite">
        <Spinner />
        <Text type="supporting">{loadingLabel}</Text>
      </VStack>
    );
  }
  if (error) {
    return (
      <VStack gap={3} align="center" padding={8} role="alert">
        <Text type="body" weight="semibold">
          Не удалось загрузить
        </Text>
        <Text type="supporting" justify="center">
          {messageFor(error)}
        </Text>
        {onRetry ? <Button label="Повторить" variant="secondary" onClick={onRetry} /> : null}
      </VStack>
    );
  }
  if (isEmpty) {
    return (
      <VStack gap={2} align="center" padding={8}>
        <Text type="body" weight="semibold" justify="center">
          {emptyTitle}
        </Text>
        {emptyHint ? (
          <Text type="supporting" justify="center">
            {emptyHint}
          </Text>
        ) : null}
      </VStack>
    );
  }
  return <>{children}</>;
}

export function SupabaseNotConfigured() {
  return (
    <VStack gap={2} align="center" padding={8}>
      <Text type="body" weight="semibold" justify="center">
        Supabase не настроен
      </Text>
      <Text type="supporting" justify="center">
        Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY. Инструкция — в SETUP.md.
      </Text>
      <HStack gap={2}>
        <Button label="Открыть SETUP.md" variant="secondary" href="/SETUP.md" />
      </HStack>
    </VStack>
  );
}
