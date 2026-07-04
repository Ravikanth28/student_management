import type { CSSProperties } from 'react';
import { APK_DOWNLOAD_URL } from '../config';
import { isNativeApp } from '../lib/platform';

function IconPhone({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  );
}
function IconDownload({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Should the "get the app" affordances render at all? */
function available(): boolean {
  return !isNativeApp() && Boolean(APK_DOWNLOAD_URL);
}

/** Prominent card for the Settings page (and the Dashboard). */
export function InstallAppCard({ style }: { style?: CSSProperties } = {}) {
  if (!available()) return null;
  return (
    <div className="card card-padded" style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--blue-light)', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}>
            <IconPhone />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Android App</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>Install the portal on your phone as a native app.</div>
          </div>
        </div>
        <a className="btn btn-primary btn-sm" href={APK_DOWNLOAD_URL} download>
          <IconDownload /> Download APK
        </a>
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
        Open the downloaded file on your phone to install it. Android will ask you to allow installing apps
        from your browser — that's expected for apps installed outside the Play Store. Sign in with the same
        credentials you use here.
      </p>
    </div>
  );
}

/** Subtle link for the Login page. */
export function GetAppLink() {
  if (!available()) return null;
  return (
    <a
      href={APK_DOWNLOAD_URL}
      download
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)' }}
    >
      <IconPhone size={15} /> Get the Android app
    </a>
  );
}
