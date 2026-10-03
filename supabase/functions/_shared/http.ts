export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-booking-token, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8'},
  });
}

export function text(body: string, contentType: string, status = 200): Response {
  return new Response(body, {status, headers: {...CORS_HEADERS, 'Content-Type': contentType}});
}

export function preflight(): Response {
  return new Response(null, {status: 204, headers: CORS_HEADERS});
}

/** Wrap a handler so thrown ApiErrors become structured JSON responses. */
export function handle(request: Request, fn: (req: Request) => Promise<Response>): Promise<Response> {
  if (request.method === 'OPTIONS') return Promise.resolve(preflight());
  return fn(request).catch((error: unknown) => {
    if (error instanceof ApiError) {
      return json({error: {code: error.code, message: error.message, details: error.details}}, error.status);
    }
    console.error('unhandled', error);
    return json({error: {code: 'internal', message: 'Внутренняя ошибка сервера'}}, 500);
  });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError('bad_json', 'Некорректный запрос', 400);
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
