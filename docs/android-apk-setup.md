# Android APK — Web → Install → Use on Mobile

The same React frontend ships as a **web app first**, and a **"Download App"** option
in the web UI hands out an Android APK built from the identical code via Capacitor.

## The end-to-end flow

1. User opens the **web app**, sees a **"Get the Android app" / "Download APK"** option
   (on the login screen and in Settings → Android App).
2. They download the APK, install it on their phone, and open it.
3. The installed app talks to your **deployed backend** and works like a native app.

The "Download App" option only appears when `VITE_APK_URL` is set and you're **not**
already inside the installed app.

---

## One-time setup

### 1. Deploy the backend (public HTTPS)
Deploy `backend/` to any host (Render, Railway, Fly.io, a VPS, etc.) so it has a
public URL like `https://api.yourschool.com`. In its environment:

- `NODE_ENV=production`
- `ADMIN_PASSWORD_HASH=<bcrypt hash>` (no plaintext `ADMIN_PASSWORD` in prod)
- `CORS_ORIGIN=https://portal.yourschool.com,https://localhost`
  - include your deployed web origin **and** `https://localhost` (the app's WebView origin)

### 2. Push the repo to GitHub

### 3. Add the backend URL as an Actions secret
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `https://api.yourschool.com` |

### 4. Build the APK in the cloud
Repo → **Actions → "Build Android APK" → Run workflow** (or push a `v*` tag).
It builds the web app pointed at your backend, wraps it with Capacitor, compiles a
debug APK, and publishes it to the **`apk-latest`** release. Stable download URL:

```
https://github.com/<OWNER>/<REPO>/releases/download/apk-latest/student-portal.apk
```

### 5. Point the web app at that APK
Set this on the **web** deployment (Vite build env), then redeploy the web app:

```
VITE_APK_URL=https://github.com/<OWNER>/<REPO>/releases/download/apk-latest/student-portal.apk
```

The **Download APK** button now appears in the web UI and serves that file.

---

## Installing on a phone
1. Open the web app on the phone → tap **Download APK** (or open the release URL).
2. Open the downloaded `student-portal.apk`; allow "install from this source" when prompted
   (normal for apps installed outside the Play Store).
3. Launch the app and sign in with the same admin credentials.

---

## Notes
- The APK is a **debug** build (auto-signed with the debug key) — installable by sideloading,
  fine for internal/college distribution. For Play Store distribution you'd add a release
  keystore and `assembleRelease`.
- The phone **cannot** reach `localhost` — that's why the app is built against the deployed
  HTTPS backend, not a dev server.
- Building locally instead of in CI requires JDK 17 + Android Studio/SDK, then:
  `cd frontend && npm run build && npx cap add android && npx cap sync android && (cd android && ./gradlew assembleDebug)`.
