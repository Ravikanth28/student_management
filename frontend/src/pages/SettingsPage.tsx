import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { InstallAppCard } from '../components/InstallApp';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { clearAppCache } from '../lib/cache';
import { useAuth } from '../state/auth';
import { YEAR_OPTIONS, YEAR_LABELS, type SystemStatus } from '../types';

// ΓöÇΓöÇΓöÇ Icons ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ΓöÇΓöÇΓöÇ Class Timings (editable period schedule) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const PERIOD_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'morning',       label: 'Morning class starts',   hint: 'On-time for the day' },
  { key: 'morning_break', label: 'Back from morning break', hint: 'Break end time' },
  { key: 'lunch',         label: 'Back from lunch',         hint: 'Lunch end time' },
  { key: 'evening_break', label: 'Back from evening break', hint: 'Break end time' },
];

function ClassTimingsCard() {
  const { success, error: toastError } = useToast();
  const [sched, setSched] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ schedule: Record<string, string> }>('/settings/period-schedule')
      .then((r) => setSched(r.data.schedule))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put<{ schedule: Record<string, string> }>('/settings/period-schedule', sched);
      setSched(r.data.schedule);
      success('Timings saved', 'Late-minutes are now calculated from these times.');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Could not save', msg ?? 'Please check the times and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-padded">
      <h3 style={cardTitle}>Class Timings</h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: -8, marginBottom: 16 }}>
        These "on-time" cut-offs drive the late-comer minutes calculation.
      </p>
      <div style={gridStyle}>
        {PERIOD_FIELDS.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
            <input
              type="time"
              className="form-control"
              value={sched[f.key] ?? ''}
              disabled={!loaded}
              onChange={(e) => setSched((s) => ({ ...s, [f.key]: e.target.value }))}
              style={{ maxWidth: 160 }}
            />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 4 }}>{f.hint}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <button className="btn btn-primary" type="button" onClick={save} disabled={saving || !loaded}>
          {saving ? 'SavingΓÇª' : 'Save timings'}
        </button>
      </div>
    </div>
  );
}

// ΓöÇΓöÇΓöÇ Academic Year ΓÇö Promotion (year rollover) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
type LastPromotion = { id: number; created_by: string | null; promoted_count: number; created_at: string } | null;

// The year-to-year transitions a promotion performs, in order.
const TRANSITIONS: { from: string; to: string }[] = [
  { from: '1', to: '2' },
  { from: '2', to: '3' },
  { from: '3', to: '4' },
  { from: '4', to: 'Alumni' },
];

function PromotionCard() {
  const { success, error: toastError } = useToast();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [last, setLast] = useState<LastPromotion>(null);
  const [show, setShow] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api.get<{ counts: Record<string, number>; lastPromotion: LastPromotion }>('/students/year-counts')
    .then((r) => { setCounts(r.data.counts); setLast(r.data.lastPromotion); })
    .catch(() => {});
  useEffect(() => { void load(); }, []);

  const willMove = TRANSITIONS.reduce((sum, t) => sum + (counts[t.from] ?? 0), 0);

  const promote = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ promoted: number }>('/students/promote');
      success('Students promoted', `${r.data.promoted} student(s) moved up a year.`);
      await load();
      setShow(false);
    } catch {
      toastError('Promotion failed', 'Could not promote students. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ reverted: number }>('/students/promote/revert');
      success('Promotion reverted', `${r.data.reverted} student(s) restored to their previous year.`);
      await load();
      setShowUndo(false);
    } catch {
      toastError('Revert failed', 'Could not revert the last promotion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-padded">
      <h3 style={cardTitle}>Academic Year ΓÇö Promotion</h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: -8, marginBottom: 16 }}>
        Move every student up one year: I ΓåÆ II ΓåÆ III ΓåÆ IV ΓåÆ Alumni. Run this once at the start of a new academic year.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {[...YEAR_OPTIONS, 'unset'].map((y) => (
          <div key={y} style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--surface-2)', minWidth: 90 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{y === 'unset' ? 'No year' : (YEAR_LABELS[y] ?? y)}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>{counts[y] ?? 0}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="button" onClick={() => setShow(true)} disabled={willMove === 0}>
          Promote all students
        </button>
        {last && (
          <button className="btn btn-outline" type="button" onClick={() => setShowUndo(true)}>
            Undo last promotion
          </button>
        )}
      </div>
      {last && (
        <p style={{ fontSize: '0.74rem', color: 'var(--text-3)', marginTop: 10 }}>
          Last promotion: {last.promoted_count} student(s){last.created_by ? ` by ${last.created_by}` : ''} on {new Date(last.created_at).toLocaleString('en-IN')}.
        </p>
      )}

      {show && (
        <ConfirmModal
          title="Promote all students?"
          description="Each student moves up one academic year. Review what will change:"
          confirmLabel={`Yes, promote ${willMove}`}
          onConfirm={promote}
          onCancel={() => setShow(false)}
          loading={busy}
        >
          <div style={{ textAlign: 'left', margin: '4px 0 8px', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {TRANSITIONS.map((t) => (
              <div key={t.from} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-2)' }}>{YEAR_LABELS[t.from]} ΓåÆ <strong style={{ color: 'var(--text)' }}>{YEAR_LABELS[t.to] ?? t.to}</strong></span>
                <span className="badge badge-blue">{counts[t.from] ?? 0}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700 }}>
              <span>Total moving</span><span>{willMove}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-3)', margin: 0 }}>
            You can undo this afterwards with "Undo last promotion".
          </p>
        </ConfirmModal>
      )}

      {showUndo && (
        <ConfirmModal
          title="Undo the last promotion?"
          description={`This restores ${last?.promoted_count ?? ''} student(s) to the year they were in before the last promotion. Genuine Alumni are not affected.`}
          confirmLabel="Yes, undo it"
          onConfirm={revert}
          onCancel={() => setShowUndo(false)}
          loading={busy}
        />
      )}
    </div>
  );
}

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
    success('Cache cleared', 'Reloading the latest versionΓÇª');
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
    <Shell
      title="Settings"
      subtitle="Portal configuration, system health, and feature status"
      onLogout={onLogout}
      actions={
        <>
          <button className="btn btn-outline" type="button" onClick={() => setShowClear(true)}>
            <IconRefresh /> Clear Cache
          </button>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/audit')}>
            <IconActivity /> Audit Log
          </button>
        </>
      }
    >
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

          {/* ΓöÇΓöÇ Live health banner ΓöÇΓöÇ */}
          <div className="card card-padded">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <h3 style={{ ...cardTitle, marginBottom: 0 }}>System Health</h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 600, color: dbConnected ? 'var(--green)' : '#b91c1c' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: dbConnected ? 'var(--green)' : '#dc2626', boxShadow: dbConnected ? '0 0 0 3px rgba(16,185,129,0.18)' : '0 0 0 3px rgba(220,38,38,0.18)' }} />
                {dbConnected ? 'All systems operational' : 'Database unreachable'}
              </span>
            </div>
            <div style={gridStyle}>
              <Field label="Environment" value={<span className={`badge ${status?.environment === 'production' ? 'badge-green' : 'badge-amber'}`}>{status?.environment ?? 'ΓÇö'}</span>} />
              <Field label="Version" value={`v${status?.version ?? 'ΓÇö'}`} />
              <Field label="Uptime" value={status ? formatUptime(status.uptimeSeconds) : 'ΓÇö'} />
              <Field label="Database" value={<StatusPill on={dbConnected} onLabel="Connected" offLabel="Offline" />} />
            </div>
          </div>

          {/* ΓöÇΓöÇ Get the mobile app ΓöÇΓöÇ */}
          <InstallAppCard />

          {/* ΓöÇΓöÇ Data overview ΓöÇΓöÇ */}
          <div className="card card-padded">
            <h3 style={cardTitle}>Data Overview</h3>
            <div style={gridStyle}>
              <Field label="Total Students" value={status?.stats.totalStudents ?? 0} />
              <Field label="Departments" value={status?.stats.totalDepartments ?? 0} />
              <Field label="Batches" value={status?.stats.totalBatches ?? 0} />
            </div>
          </div>

          {/* ΓöÇΓöÇ Class timings (editable) ΓöÇΓöÇ */}
          <ClassTimingsCard />

          {/* ΓöÇΓöÇ Academic year promotion ΓöÇΓöÇ */}
          <PromotionCard />

          {/* ΓöÇΓöÇ Feature status ΓöÇΓöÇ */}
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

          {/* ΓöÇΓöÇ Admin account ΓöÇΓöÇ */}
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
              <Field label="Session Expiry" value={status?.auth.jwtExpiresIn ?? 'ΓÇö'} />
            </div>
          </div>

          {/* ΓöÇΓöÇ System information ΓöÇΓöÇ */}
          <div className="card card-padded">
            <h3 style={cardTitle}>System Information</h3>
            <div style={gridStyle}>
              <Field label="Backend" value={status?.backend ?? 'Node.js + Express'} />
              <Field label="Frontend" value={status?.frontend ?? 'React + Vite'} />
              <Field label="Database" value={status?.database.driver ?? 'TiDB Cloud (MySQL)'} />
              <Field label="Server Time" value={status ? new Date(status.serverTime).toLocaleString('en-IN') : 'ΓÇö'} />
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
