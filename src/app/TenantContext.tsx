import {createContext, useContext, type ReactNode} from 'react';
import type {ApiService, ApiTenant, ApiWork} from '@/types/api';

export interface TenantContextValue {
  slug: string;
  tenant: ApiTenant;
  services: ApiService[];
  works: ApiWork[];
  serverTime: string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({value, children}: {value: TenantContextValue; children: ReactNode}) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenantContext must be used inside a tenant route');
  return value;
}

export function useOptionalTenantContext(): TenantContextValue | null {
  return useContext(TenantContext);
}
