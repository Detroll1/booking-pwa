/**
 * Register the service worker scoped to the studio, so each tenant has its own
 * worker scope and cache namespace over the shared build.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const match = /^\/s\/([^/]+)(\/|$)/.exec(window.location.pathname);
  const slug = match?.[1];
  const swUrl = slug ? `/s/${slug}/sw.js` : '/sw.js';
  const scope = slug ? `/s/${slug}/` : '/';
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, {scope}).catch(() => {
      // A tenant worker may not exist yet before `tenant:publish`; fall back to root.
      if (slug) navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(() => undefined);
    });
  });
}

export interface TenantMeta {
  slug: string;
  name: string;
  accent: string | null;
  logoUrl: string | null;
}

/** Per-tenant HTML metadata: title, theme color, apple-touch-icon, manifest. */
export function applyTenantMeta(meta: TenantMeta): void {
  document.title = meta.name;
  setMeta('theme-color', meta.accent ?? '#0a0a0b');
  setMeta('apple-mobile-web-app-title', meta.name);
  setLink('apple-touch-icon', meta.logoUrl ?? `/s/${meta.slug}/apple-touch-icon.png`);
  setLink('manifest', `/s/${meta.slug}/manifest.webmanifest`);
  setMeta('mobile-web-app-capable', 'yes');
}

function setMeta(name: string, content: string): void {
  let node = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('name', name);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function setLink(rel: string, href: string): void {
  let node = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', rel);
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
}
