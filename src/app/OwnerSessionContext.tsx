import {createContext, useContext, type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';

export interface OwnerSessionValue {
  slug: string;
  session: Session;
}

const OwnerSessionContext = createContext<OwnerSessionValue | null>(null);

export function OwnerSessionProvider({value, children}: {value: OwnerSessionValue; children: ReactNode}) {
  return <OwnerSessionContext.Provider value={value}>{children}</OwnerSessionContext.Provider>;
}

export function useOwnerSession(): OwnerSessionValue {
  const value = useContext(OwnerSessionContext);
  if (!value) throw new Error('useOwnerSession must be used inside the owner layout');
  return value;
}
