import type {ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {Theme} from '@astryxdesign/core/theme';
import {appTheme} from '@/themes/app/app';
import {queryClient} from './queryClient';

export function AppProviders({children}: {children: ReactNode}) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme theme={appTheme} mode="dark">
        {children}
      </Theme>
    </QueryClientProvider>
  );
}
