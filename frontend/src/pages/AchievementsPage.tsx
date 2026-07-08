import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { AchievementForm } from '../components/AchievementForm';
import { ConfirmModal } from '../components/ConfirmModal';
import { StudentActivityModal } from '../components/StudentActivityModal';
import { useToast } from '../components/Toast';
import { EVENT_TYPE_LABELS, YEAR_LABELS, type Achievement, type AchievementListResponse, type AchievementSummaryRow, type Student } from '../types';

type Props = { onLogout: () => void };
const LIMIT = 20;

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AchievementsPage({ onLogout }: Props) {
  const { success, error: toastError } = useToast();
  const [view, setView] = useState<'records' | 'summary'>('records');
  const [rows, setRows] = useState<Achievement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Achievement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AchievementListResponse>('/achievements', { params: { page, limit: LIMIT, q: q || undefined } });
      setRows(res.data.data);
      setTotal(res.data.meta.total);
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => { if (view === 'records') void fetchRows(); }, [view, fetchRows]);

  // ── Summary view ──
  const [summary, setSummary] = useState<AchievementSummaryRow[]>([]);
  const [sQ, setSQ] = useState('');
  const [sLoading, setSLoading] = useState(false);
  const fetchSummary = useCallback(async () => {
    setSLoading(true);
    try {
      const res = await api.get<{ data: AchievementSummaryRow[] }>('/achievements/summary', { params: { q: sQ || undefined } });
      setSummary(res.data.data);
    } catch { setSummary([]); } finally { setSLoading(false); }
  }, [sQ]);
  useEffect(() => { if (view === 'summary') void fetchSummary(); }, [view, fetchSummary]);

  // ── Per-student "View" popup ──
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [viewAch, setViewAch] = useState<Achievement[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const openView = async (studentId: number) => {
    setViewOpen(true); setViewLoading(true); setViewStudent(null); setViewAch([]);
    try {
      const [s, ach] = await Promise.all([
        api.get<Student>(`/students/${studentId}`),
        api.get<{ data: Achievement[] }>(`/students/${studentId}/achievements`),
      ]);
      setViewStudent(s.data);
      setViewAch(ach.data.data);
    } catch { /* ignore */ } finally { setViewLoading(false); }
  };
  const vWins = viewAch.filter((a) => a.result === 'winner').length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/achievements/${deleteTarget.id}`);
      success('Deleted', 'Achievement removed.');
      setDeleteTarget(null);
      void fetchRows();
    } catch {
      toastError('Delete failed', 'Could not remove the achievement.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Shell
      title="Achievements"
      subtitle="Hackathons, competitions, and awards"
      onLogout={onLogout}
      actions={
        <>
          <button type="button" className={`btn btn-sm ${view === 'records' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('records')}>Records</button>
          <button type="button" className={`btn btn-sm ${view === 'summary' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('summary')}>Summary</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add achievement</button>
        </>
      }
    >
      {view === 'summary' ? (
        <div className="card">
          <div className="toolbar">
            <input className="form-control" style={{ height: 40, flex: 1, minWidth: 180 }} placeholder="Search name / number…" value={sQ} onChange={(e) => setSQ(e.target.value)} />
          </div>
          {sLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}</div>
          ) : summary.length === 0 ? (
            <div className="empty-state"><p className="empty-title">No achievements yet</p><p className="empty-sub">Nothing to summarise.</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>#</th><th>Name</th><th>Register No.</th><th>Year</th><th>Sec</th><th>Total</th><th>Wins</th><th>Participated</th><th></th></tr></thead>
                <tbody>
                  {summary.map((r, i) => (
                    <tr key={r.student_id}>
                      <td className="td-muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="td-muted">{r.register_number}</td>
                      <td>{r.year ? (YEAR_LABELS[r.year] ?? r.year) : '—'}</td>
                      <td>{r.section}</td>
                      <td><span className="badge badge-navy">{r.total}</span></td>
                      <td><span className="badge badge-green">{r.wins}</span></td>
                      <td className="td-muted">{r.participated}</td>
                      <td style={{ textAlign: 'right' }}><button className="btn btn-outline btn-sm" type="button" onClick={() => void openView(r.student_id)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="card">
        <div className="toolbar">
          <input className="form-control" style={{ height: 40, flex: 1, minWidth: 180 }} placeholder="Search title / venue…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>

        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p className="empty-title">No achievements yet</p><p className="empty-sub">Add one, or record via the Scanner.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Event Type</th><th>Event Name</th><th>Result</th><th>Position</th><th>Venue</th><th>Duration</th><th>Date</th><th>Prize</th><th>Members</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td><span className="badge badge-navy">{EVENT_TYPE_LABELS[a.event_type ?? 'other'] ?? a.event_type}</span></td>
                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                    <td>
                      <span className={`badge ${a.result === 'winner' ? 'badge-green' : 'badge-gray'}`}>
                        {a.result === 'winner' ? 'Winner' : 'Participated'}
                      </span>
                    </td>
                    <td className="td-muted">{a.result === 'winner' ? (a.position ?? '—') : '—'}</td>
                    <td className="td-muted">{a.venue ?? '—'}</td>
                    <td className="td-muted">{a.duration ?? '—'}</td>
                    <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.event_date)}</td>
                    <td className="td-muted">{a.prize ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 320 }}>
                        {a.members.map((m) => (
                          <span key={m.student_id} className="badge badge-blue">{m.name} <span style={{ opacity: 0.7 }}>({m.register_number}{m.year ? ` · ${YEAR_LABELS[m.year] ?? m.year}` : ''})</span></span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-outline btn-sm" style={{ marginRight: 6 }} onClick={() => setEditTarget(a)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(a)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={setPage} noun="achievements" />
      </div>
      )}

      {viewOpen && (
        <StudentActivityModal
          student={viewStudent}
          title="Achievements"
          loading={viewLoading}
          onClose={() => setViewOpen(false)}
          kpis={[
            { label: 'Total', value: viewAch.length, tone: 'default' },
            { label: 'Wins', value: vWins, tone: 'green' },
            { label: 'Participated', value: viewAch.length - vWins, tone: 'default' },
          ]}
        >
          {viewAch.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>No achievements.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Event</th><th>Type</th><th>Result</th><th>Position</th></tr></thead>
                <tbody>
                  {viewAch.map((a) => (
                    <tr key={a.id}>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.event_date)}</td>
                      <td style={{ fontWeight: 600 }}>{a.title}</td>
                      <td><span className="badge badge-navy">{EVENT_TYPE_LABELS[a.event_type ?? 'other'] ?? a.event_type}</span></td>
                      <td><span className={`badge ${a.result === 'winner' ? 'badge-green' : 'badge-gray'}`}>{a.result === 'winner' ? 'Winner' : 'Participated'}</span></td>
                      <td className="td-muted">{a.result === 'winner' ? (a.position ?? '—') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StudentActivityModal>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 'clamp(18px, 4vw, 28px)' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14 }}>Add achievement</h2>
            <AchievementForm onSuccess={() => { setShowAdd(false); void fetchRows(); }} onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null); }}>
          <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 'clamp(18px, 4vw, 28px)' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14 }}>Edit achievement</h2>
            <AchievementForm edit={editTarget} onSuccess={() => { setEditTarget(null); void fetchRows(); }} onCancel={() => setEditTarget(null)} />
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete achievement?"
          description={`Remove "${deleteTarget.title}"? This removes it from all ${deleteTarget.members.length} member(s).`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </Shell>
  );
}
