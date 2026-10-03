export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function bookingToken(request: Request): string {
  const token = request.headers.get('x-booking-token');
  if (!token || token.length < 16) {
    return '';
  }
  return token;
}
