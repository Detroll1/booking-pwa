import {useEffect, useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '@/lib/supabase/client';
import {clearPrivateCache} from '@/app/queryClient';

export interface AuthState {
  session: Session | null;
  isLoading: boolean;
}

export function useAuth(): AuthState & {signOut: () => Promise<void>} {
  const [state, setState] = useState<AuthState>({session: null, isLoading: true});

  useEffect(() => {
    if (!supabase) {
      setState({session: null, isLoading: false});
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({data}) => {
      if (active) setState({session: data.session, isLoading: false});
    });
    const {data: subscription} = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({session, isLoading: false});
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return {
    ...state,
    signOut: async () => {
      clearPrivateCache();
      if (supabase) await supabase.auth.signOut();
    },
  };
}
