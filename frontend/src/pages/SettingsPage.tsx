import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { InstallAppCard } from '../components/InstallApp';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { clearAppCache } from '../lib/cache';
import { useAuth } from '../state/auth';
import type { SystemStatus } from '../types';

// ─── Icons ────────────────────────────────────────────────────
function IconCloud() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function IconExport() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function IconDrive() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" /><line x1="12" y1="22" x2="12" y2="15.5" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IconChevRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

type Props = { onLogout: () => void };

function StatusPill({ on, onLabel = 'Live', offLabel = 'Off' }: { on: boolean; onLabel?: string; offLabel?: string }) {
  return <span className={`badge ${on ? 'badge-green' : 'badge-gray'}`}>{on ? onLabel : offLabel}</span>;
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '<1m';
}

/** Best-effort decode of the JWT payload to show the current admin username. */
function usernameFromToken(token: string | null): string {
  if (!token) return 'admin';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return payload.username ?? 'admin';
  } catch {
    return 'admin';
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

const cardTitle: React.CSSProperties = { fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: 16 };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 };

export function SettingsPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { success } = useToast();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClearCache = async () => {
    setClearing(true);
    await clearAppCache();
    success('Cache cleared', 'Reloading the latest version…');
    setTimeout(() => window.location.reload(), 600);
  };

  useEffect(() => {
    let active = true;
    api.get<SystemStatus>('/system/status')
      .then(res => { if (active) setStatus(res.data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const username = usernameFromToken(token);
  const dbConnected = status?.database.connected ?? false;

  const featureRows = [
    { icon: <IconCloud />,  title: 'Cloudinary Photos',      desc: 'Student photo upload, auto face-crop & CDN delivery.', on: status?.features.cloudinary ?? false },
    { icon: <IconFile />,   title: 'Bulk CSV / Excel Import', desc: 'Import hundreds of students in one upload.',            on: status?.features.bulkImport ?? false },
    { icon: <IconExport />, title: 'Data Export',             desc: 'Export filtered student lists to CSV or Excel.',       on: status?.features.export ?? false },
    { icon: <IconDrive />,  title: 'Google Drive Photo Sync', desc: 'Auto-match & import photos from a Drive folder.',      on: status?.features.googleDrive ?? false },
  ];

  return (
    <Shell title="Settings" subtitle="Portal configuration, system health, and feature status" onLogout={onLogout}>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div className="card card-padded" style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
              <div style={{ fontWeight: 600, color: '#b91c1c', fontSize: '0.85rem' }}>
                Could not reach the backend for live status. Showing limited information.
              </div>
            </div>
          )}

          {/* ── Live health banner ── */}
          <div className="card card-padded">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <h3 style={{ ...cardTitle, marginBottom: 0 }}>System Health</h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 600, color: dbConnected ? 'var(--green)' : '#b91c1c' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: dbConnected ? 'var(--green)' : '#dc2626', boxShadow: dbConnected ? '0 0 0 3px rgba(16,185,129,0.18)' : '0 0 0 3px rgba(220,38,38,0.18)' }} />
                {dbConnected ? 'All systems operational' : 'Database unreachable'}
              </span>
            </div>
            <div style={gridStyle}>
              <Field label="Environment" value={<span className={`badge ${status?.environment === 'production' ? 'badge-green' : 'badge-amber'}`}>{status?.environment ?? '—'}</span>} />
              <Field label="Version" value={`v${status?.version ?? '—'}`} />
              <Field label="Uptime" value={status ? formatUptime(status.uptimeSeconds) : '—'} />
              <Field label="Database" value={<StatusPill on={dbConnected} onLabel="Connected" offLabel="Offline" />} />
            </div>
          </div>

          {/* ── Get the mobile app ── */}
          <InstallAppCard />

          {/* ── Data overview ── */}
          <div className="card card-padded">
            <h3 style={cardTitle}>Data Overview</h3>
            <div style={gridStyle}>
              <Field label="Total Students" value={status?.stats.totalStudents ?? 0} />
              <Field label="Departments" value={status?.stats.totalDepartments ?? 0} />
              <Field label="Batches" value={status?.stats.totalBatches ?? 0} />
            </div>
          </div>

          {/* ── Feature status ── */}
          <div className="card card-padded">
            <h3 style={cardTitle}>Feature Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {featureRows.map(f => (
                <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--navy)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{f.title}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>{f.desc}</div>
                  </div>
                  <StatusPill on={f.on} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Admin account ── */}
          <div className="card card-padded">
            <h3 style={cardTitle}>Admin Account</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <IconUser />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{username}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>Administrator</div>
              </div>
            </div>
            <div style={gridStyle}>
              <Field label="Role" value={<span className="badge badge-navy">admin</span>} />
              <Field label="Auth Method" value={status?.auth.method ?? 'JWT + bcrypt'} />
              <Field label="Session Expiry" value={status?.auth.jwtExpiresIn ?? '—'} />
            </div>
          </div>

          {/* ── System information ── */}
          <div className="card card-padded">
            <h3 style={cardTitle}>System Information</h3>
            <div style={gridStyle}>
              <Field label="Backend" value={status?.backend ?? 'Node.js + Express'} />
              <Field label="Frontend" value={status?.frontend ?? 'React + Vite'} />
              <Field label="Database" value={status?.database.driver ?? 'TiDB Cloud (MySQL)'} />
              <Field label="Server Time" value={status ? new Date(status.serverTime).toLocaleString('en-IN') : '—'} />
            </div>
          </div>

          {/* ── Security & activity ── */}
          <div className="card card-padded">
            <h3 style={cardTitle}>Security &amp; Activity</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue-light)', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}>
                  <IconActivity />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Audit Log</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>Full trail of logins, edits, deletes, and imports.</div>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate('/audit')}>
                View Audit Log
                <IconChevRight />
              </button>
            </div>
          </div>

          {/* ── Storage & cache ── */}
          <div className="card card-padded">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--amber-light)', color: 'var(--amber)', display: 'grid', placeItems: 'center' }}>
                  <IconRefresh />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Storage &amp; Cache</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>Clear locally cached files and reload the latest version. You stay signed in.</div>
                </div>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowClear(true)}>
                <IconRefresh /> Clear cache
              </button>
            </div>
          </div>
        </div>
      )}

      {showClear && (
        <ConfirmModal
          title="Clear cached data?"
          description="This clears cached files and reloads the app with the latest version. You'll stay signed in."
          confirmLabel="Clear & reload"
          onConfirm={handleClearCache}
          onCancel={() => setShowClear(false)}
          loading={clearing}
        />
      )}
    </Shell>
  );
}
