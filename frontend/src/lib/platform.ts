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
