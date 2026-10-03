/**
 * Runtime tenant branding. The accent is the single configurable color of the
 * product; it is read from the tenant config at runtime and never hardcoded in
 * business screens. Astryx accent tokens point at var(--tenant-accent).
 */
export interface TenantThemeInput {
  accent?: string | null;
  surfaceImageUrl?: string | null;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function sanitizeAccent(accent: string | null | undefined, fallback = '#4690ff'): string {
  if (accent && HEX_COLOR.test(accent)) return accent;
  return fallback;
}

export function applyTenantTheme(input: TenantThemeInput, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--tenant-accent', sanitizeAccent(input.accent));
  root.style.setProperty(
    '--tenant-accent-soft',
    `color-mix(in oklab, ${sanitizeAccent(input.accent)} 18%, transparent)`,
  );
  root.style.setProperty('--tenant-surface-image', input.surfaceImageUrl ? `url("${input.surfaceImageUrl}")` : 'none');
}
