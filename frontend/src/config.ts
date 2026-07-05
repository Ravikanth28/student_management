// In development: Vite proxies /api/* → localhost:4000 (no CORS issues)
// In production/web: set VITE_API_BASE_URL to your deployed backend URL
// In the Android APK build: VITE_API_BASE_URL MUST be the deployed HTTPS backend
// (the phone cannot reach "localhost").
const rawApiBase = import.meta.env.VITE_API_BASE_URL ?? '';
// Allow a bare host (e.g. "student-portal-api.onrender.com" from Render's
// fromService wiring) by upgrading it to a full https:// URL.
export const API_BASE_URL =
  rawApiBase && !/^https?:\/\//i.test(rawApiBase) ? `https://${rawApiBase}` : rawApiBase;

// Public URL where the built Android APK can be downloaded. Shown as a
// "Download App" option in the web UI. Left blank → the option is hidden.
// Typically your GitHub release asset:
//   https://github.com/<OWNER>/<REPO>/releases/download/apk-latest/student-portal.apk
export const APK_DOWNLOAD_URL = import.meta.env.VITE_APK_URL ?? '';

// Current app version (from package.json). The installed APK is stamped with the
// same value; if an installed app reports an older version, it prompts to update.
export const APP_VERSION = __APP_VERSION__;
