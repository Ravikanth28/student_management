import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { AchievementForm } from '../components/AchievementForm';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { EVENT_TYPE_LABELS, type Achievement, type AchievementListResponse } from '../types';

type Props = { onLogout: () => void };
const LIMIT = 20;

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AchievementsPage({ onLogout }: Props) {
  const { success, error: toastError } = useToast();
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

  useEffect(() => { void fetchRows(); }, [fetchRows]);

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
      actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add achievement</button>}
    >
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
                          <span key={m.student_id} className="badge badge-blue">{m.name} <span style={{ opacity: 0.7 }}>({m.register_number})</span></span>
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
