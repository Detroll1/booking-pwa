import type {SupabaseClient} from '@supabase/supabase-js';
import {ApiError} from './http.ts';

/** Call a Postgres RPC and convert Postgres error codes into ApiErrors. */
export async function rpc<T = unknown>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const {data, error} = await client.rpc(name, args);
  if (error) {
    const code = mapCode(error.message, error.code);
    throw new ApiError(code, humanMessage(code), code === 'not_found' ? 404 : code === 'conflict' ? 409 : 400);
  }
  return data as T;
}

const MESSAGES: Record<string, string> = {
  tenant_not_found: 'Студия не найдена',
  service_not_available: 'Услуга недоступна',
  booking_not_found: 'Запись не найдена',
  booking_not_active: 'Эту запись больше нельзя изменить',
  too_soon: 'Слишком поздно для этой записи',
  outside_working_hours: 'Это время вне часов работы',
  customer_required: 'Укажите имя и телефон',
  no_resource_available: 'Это время уже занято — выберите другое',
  conflict: 'Это время уже занято — выберите другое',
  bad_status: 'Недопустимый статус',
  bad_payment_kind: 'Недопустимый тип платежа',
  bad_amount: 'Недопустимая сумма',
};

export function mapCode(message: string, pgCode?: string): string {
  if (message.includes('no_resource_available')) return 'conflict';
  for (const key of Object.keys(MESSAGES)) {
    if (message.includes(key)) return key;
  }
  if (pgCode === '23P01') return 'conflict';
  return 'db_error';
}

export function humanMessage(code: string): string {
  return MESSAGES[code] ?? 'Не удалось выполнить операцию';
}
