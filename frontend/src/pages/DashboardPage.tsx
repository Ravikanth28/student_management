import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { InstallAppCard } from '../components/InstallApp';
import { AppUpdateBanner } from '../components/AppUpdateBanner';
import { useAuth } from '../state/auth';
import { isStaff } from '../lib/roles';
import type { Student } from '../types';

// ─── SVG Icons ──────────────────────────────────────────────
function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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

// ─── Types ──────────────────────────────────────────────────
interface DashboardStats {
  totalStudents: number;
  totalDepartments: number;
  totalBatches: number;
  recentStudents: Student[];
}

const STAT_CARDS = [
  { key: 'totalStudents',    label: 'Total Students',   Icon: IconUsers,    color: 'blue',  sub: 'Registered records' },
  { key: 'totalDepartments', label: 'Departments',       Icon: IconBuilding, color: 'navy',  sub: 'Academic departments' },
  { key: 'totalBatches',     label: 'Batches',           Icon: IconCalendar, color: 'green', sub: 'Active batches' },
  { key: 'recent',           label: 'Recently Added',    Icon: IconClock,    color: 'amber', sub: 'Last 5 students' },
] as const;

function SkeletonStat() {
  return (
    <div className="stat-card">
      <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 12 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 28, width: '40%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '50%', borderRadius: 6 }} />
      </div>
    </div>
  );
}

type Props = { onLogout: () => void };

export function DashboardPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { role, displayName } = useAuth();
  const staff = isStaff(role);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const res = await api.get<DashboardStats>('/students/stats');
        if (active) setStats(res.data);
      } catch {
        // If stats endpoint fails, fall back to empty
        if (active) setStats({ totalStudents: 0, totalDepartments: 0, totalBatches: 0, recentStudents: [] });
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchStats();
    return () => { active = false; };
  }, []);

  const statValues: Record<string, number> = {
    totalStudents:    stats?.totalStudents ?? 0,
    totalDepartments: stats?.totalDepartments ?? 0,
    totalBatches:     stats?.totalBatches ?? 0,
    recent:           stats?.recentStudents.length ?? 0,
  };

  return (
    <Shell
      title={`Welcome back, ${displayName ?? 'there'}`}
      subtitle={`You're signed in as ${role ?? 'user'} · here's your overview`}
      onLogout={onLogout}
      actions={
        !staff ? undefined : (
        <>
          <button className="btn btn-outline" type="button" onClick={() => navigate('/scanner')} id="dashboard-scan">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="3" y1="12" x2="21" y2="12" />
            </svg>
            Scan ID
          </button>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/students/new')} id="dashboard-add-student">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Student
          </button>
        </>
        )
      }
    >
      {/* Prompt installed apps to update when a newer version exists */}
      <AppUpdateBanner />

      {/* Get the mobile app (hidden inside the installed app / when no APK URL is set) */}
      <InstallAppCard style={{ marginBottom: 16 }} />

      {/* Stat Cards */}
      <div className="stat-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)
          : STAT_CARDS.map(({ key, label, Icon, color, sub }) => (
            <article key={key} className="stat-card">
              <div className={`stat-icon ${color}`}>
                <Icon />
              </div>
              <div>
                <div className="stat-label">{label}</div>
                <div className="stat-value">{statValues[key]}</div>
                <div className="stat-sub">{sub}</div>
              </div>
            </article>
          ))}
      </div>

      {/* Recent Students */}
      <div className="card">
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>Recently Added Students</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 2 }}>Last 5 student records added to the system</p>
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate('/students')} id="dashboard-view-all">
            View All
            <IconChevRight />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '60%', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : stats?.recentStudents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <IconUsers />
            </div>
            <p className="empty-title">No students yet</p>
            <p className="empty-sub">Add your first student record to get started.</p>
            {staff && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} type="button" onClick={() => navigate('/students/new')}>
                Add First Student
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Register No.</th>
                  <th>Department</th>
                  <th>Batch</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentStudents.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className="td-muted">{s.register_number}</td>
                    <td>
                      <span className="badge badge-blue">{s.department}</span>
                    </td>
                    <td>
                      <span className="badge badge-gray">{s.batch}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={() => navigate(`/students/${s.id}`)}
                        id={`dashboard-view-${s.id}`}
                      >
                        View
                        <IconChevRight />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
