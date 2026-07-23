import { useState, useEffect, type CSSProperties } from 'react';
import { APK_DOWNLOAD_URL } from '../config';

const DEFAULT_APK_LINK = APK_DOWNLOAD_URL || '/student-portal.apk';

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

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function InstallAppModal({ onClose }: { onClose: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('To install on Android/Chrome: Tap Chrome menu (⋮) → "Add to Home screen"\nTo install on iOS/Safari: Tap Share (⎋) → "Add to Home Screen"');
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 24, position: 'relative' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', right: 16, top: 16, background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
        >
          <IconX />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--blue-light)', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}>
            <IconPhone size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Install Mobile App</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0 }}>Student Management Portal for Android & iOS</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          {/* APK Download option */}
          <a
            href={DEFAULT_APK_LINK}
            download="student-portal.apk"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', gap: 8 }}
          >
            <IconDownload size={18} /> Download Android APK
          </a>

          {/* Web App / PWA Install option */}
          <button
            type="button"
            className="btn btn-outline btn-lg"
            onClick={handleInstallPWA}
            style={{ width: '100%', justifyContent: 'center', gap: 8 }}
          >
            <IconPhone size={18} /> {deferredPrompt ? 'Install App on Phone' : 'Add to Home Screen (PWA Guide)'}
          </button>
        </div>

        <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
          <strong>📱 How to install on your phone:</strong>
          <ol style={{ paddingLeft: 16, marginTop: 6, marginBottom: 0 }}>
            <li><strong>Android:</strong> Click <em>Download Android APK</em> above to download the installer, or tap Chrome menu (⋮) ➔ <em>Add to Home screen</em>.</li>
            <li><strong>iPhone / iOS:</strong> Open in Safari, tap the Share button (⎋) ➔ select <em>Add to Home Screen</em>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Prominent card for the Settings & Dashboard pages. */
export function InstallAppCard({ style }: { style?: CSSProperties } = {}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="card card-padded" style={style}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--blue-light)', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}>
              <IconPhone />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Mobile App & APK Download</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>Install the portal on your Android or iOS device.</div>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <IconDownload /> Download App / APK
          </button>
        </div>
      </div>
      {showModal && <InstallAppModal onClose={() => setShowModal(false)} />}
    </>
  );
}

/** Link for the Login page. */
export function GetAppLink() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--blue)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <IconPhone size={16} /> Download Mobile App (APK)
      </button>
      {showModal && <InstallAppModal onClose={() => setShowModal(false)} />}
    </>
  );
}
