// In development: Vite proxies /api/* → localhost:4000 (no CORS issues)
// In production/web: set VITE_API_BASE_URL to your deployed backend URL
// In the Android APK build: VITE_API_BASE_URL MUST be the deployed HTTPS backend
// (the phone cannot reach "localhost").
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// Public URL where the built Android APK can be downloaded. Shown as a
// "Download App" option in the web UI. Left blank → the option is hidden.
// Typically your GitHub release asset:
//   https://github.com/<OWNER>/<REPO>/releases/download/apk-latest/student-portal.apk
export const APK_DOWNLOAD_URL = import.meta.env.VITE_APK_URL ?? '';
