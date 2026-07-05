/**
 * True when the app is running inside the installed native (Capacitor) shell
 * rather than a normal web browser. Used to hide "Download the app" prompts
 * when the user is already in the app.
 *
 * Capacitor injects a global `window.Capacitor` at runtime; we read it
 * defensively so no build-time dependency is required.
 */
export function isNativeApp(): boolean {
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * The installed native app's version (versionName), or null on the web / on error.
 * Loaded lazily so the Capacitor App plugin isn't pulled into the web bundle path.
 */
export async function getNativeAppVersion(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return info.version ?? null;
  } catch {
    return null;
  }
}
