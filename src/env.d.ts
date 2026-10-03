/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_DEFAULT_TENANT?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_DEMO?: string;
  readonly VITE_HASH_ROUTER?: string;
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
