import { useEffect, useState } from 'react';
import { APK_DOWNLOAD_URL, APP_VERSION } from '../config';
import { getNativeAppVersion } from '../lib/platform';

/**
 * Shows only inside the installed Android app, and only when its version is
 * older than the current release — prompting the user to install the latest APK.
 * On the web (and when the app is up to date) it renders nothing.
 */
export function AppUpdateBanner() {
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);

  useEffect(() => {
    getNativeAppVersion().then(setInstalledVersion);
  }, []);

  if (!installedVersion || installedVersion === APP_VERSION) return null;

  return (
    <div
      className="card card-padded"
      style={{ marginBottom: 16, border: '1px solid var(--amber)', background: 'var(--amber-light)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(217,119,6,0.18)', color: 'var(--amber)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 20 }}>
            ⬆️
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>App update available</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
              You have v{installedVersion}; the latest is v{APP_VERSION}. Please uninstall the current app and install the newest version.
            </div>
          </div>
        </div>
        {APK_DOWNLOAD_URL && (
          <a className="btn btn-primary btn-sm" href={APK_DOWNLOAD_URL} download>
            Download latest
          </a>
        )}
      </div>
    </div>
  );
}
