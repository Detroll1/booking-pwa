import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {ApiError} from './http.ts';

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (cached) return cached;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new ApiError('server_not_configured', 'Серверные секреты Supabase не заданы', 500);
  }
  cached = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  return cached;
}

export function accessTokenSecret(): string {
  const secret = Deno.env.get('ACCESS_TOKEN_SECRET') ?? Deno.env.get('CRON_SECRET');
  if (!secret) {
    throw new ApiError('server_not_configured', 'ACCESS_TOKEN_SECRET не задан', 500);
  }
  return secret;
}

export function tenantIdBySlug(slug: string): Promise<string> {
  return serviceClient()
    .from('tenants')
    .select('id,status')
    .eq('slug', slug)
    .maybeSingle()
    .then(({data, error}) => {
      if (error) throw new ApiError('db_error', error.message, 500);
      if (!data) throw new ApiError('tenant_not_found', 'Студия не найдена', 404);
      return data.id as string;
    });
}
