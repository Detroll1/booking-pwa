export const TENANT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function isValidSlug(slug: string): boolean {
  return TENANT_SLUG_PATTERN.test(slug);
}

export function defaultTenantSlug(): string {
  return import.meta.env.VITE_DEFAULT_TENANT ?? 'graphite-detailing';
}

/** Extract the tenant slug from a /s/{slug}/... pathname, or null. */
export function slugFromPathname(pathname: string): string | null {
  const match = /^\/s\/([^/?#]+)/.exec(pathname);
  if (!match) return null;
  const slug = match[1];
  return slug && isValidSlug(slug) ? slug : null;
}

export function tenantPath(slug: string, sub = ''): string {
  const clean = sub.replace(/^\/+/, '');
  return clean ? `/s/${slug}/${clean}` : `/s/${slug}/`;
}

export function ownerPath(slug: string, sub = ''): string {
  return tenantPath(slug, `owner/${sub.replace(/^\/+/, '')}`);
}
