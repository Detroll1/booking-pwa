import type {User} from '@supabase/supabase-js';
import {serviceClient} from './db.ts';
import {ApiError} from './http.ts';

export interface OwnerContext {
  user: User;
  tenantId: string;
  role: string;
}

/** Verify the Supabase JWT and the tenant membership on the server. */
export async function requireOwner(request: Request, slug: string): Promise<OwnerContext> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new ApiError('unauthorized', 'Требуется вход владельца', 401);

  const client = serviceClient();
  const {data, error} = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError('unauthorized', 'Сессия недействительна', 401);
  const user = data.user;

  const {data: tenant, error: tenantError} = await client
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (tenantError) throw new ApiError('db_error', tenantError.message, 500);
  if (!tenant) throw new ApiError('tenant_not_found', 'Студия не найдена', 404);

  const {data: membership} = await client
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) throw new ApiError('forbidden', 'Нет доступа к этой студии', 403);

  return {user, tenantId: tenant.id, role: membership.role as string};
}
