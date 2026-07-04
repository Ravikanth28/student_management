/**
 * Clears client-side caches so a reload pulls the freshest app + data:
 *  - Cache Storage (cached bundles/assets)
 *  - Service worker registrations
 *  - sessionStorage
 *
 * The auth token in localStorage is intentionally kept, so the user stays
 * signed in. Each step is best-effort and never throws.
 */
export async function clearAppCache(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* ignore */ }

  try {
    sessionStorage.clear();
  } catch { /* ignore */ }
}
