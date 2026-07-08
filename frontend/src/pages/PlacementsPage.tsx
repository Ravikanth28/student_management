import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { PlacementForm } from '../components/PlacementForm';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { PLACEMENT_TYPE_LABELS, OFFER_TYPE_LABELS, type Placement, type PlacementListResponse } from '../types';

type Props = { onLogout: () => void };
const LIMIT = 20;

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
  background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-lg)', padding: 'clamp(18px, 4vw, 28px)',
};

export function PlacementsPage({ onLogout }: Props) {
  const { success, error: toastError } = useToast();
  const [rows, setRows] = useState<Placement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Placement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Placement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PlacementListResponse>('/placements', { params: { page, limit: LIMIT, q: q || undefined } });
      setRows(res.data.data);
      setTotal(res.data.meta.total);
    } catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, q]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/placements/${deleteTarget.id}`);
      success('Deleted', 'Placement removed.');
      setDeleteTarget(null);
      void fetchRows();
    } catch { toastError('Delete failed', 'Please try again.'); } finally { setDeleting(false); }
  };

  return (
    <Shell
      title="Placements"
      subtitle="Company offers — on & off campus"
      onLogout={onLogout}
      actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add placement</button>}
    >
      <div className="card">
        <div className="toolbar">
          <input className="form-control" style={{ height: 40, flex: 1, minWidth: 180 }} placeholder="Search company / student…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>

        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p className="empty-title">No placements yet</p><p className="empty-sub">Add one, or record via the Scanner.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Student</th><th>Register No.</th><th>Company</th><th>Position</th><th>Package</th><th>Type</th><th>Offer</th><th>Date</th><th>Action</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="td-muted">{p.register_number}</td>
                    <td>{p.company}</td>
                    <td className="td-muted">{p.position ?? '—'}</td>
                    <td className="td-muted">{p.package ?? '—'}</td>
                    <td><span className={`badge ${p.placement_type === 'on_campus' ? 'badge-green' : 'badge-blue'}`}>{PLACEMENT_TYPE_LABELS[p.placement_type] ?? p.placement_type}</span></td>
                    <td className="td-muted">{p.offer_type ? OFFER_TYPE_LABELS[p.offer_type] ?? p.offer_type : '—'}</td>
                    <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.placed_date)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-outline btn-sm" style={{ marginRight: 6 }} onClick={() => setEditTarget(p)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={setPage} noun="placements" />
      </div>

      {showAdd && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={modalBox}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14 }}>Add placement</h2>
            <PlacementForm onSuccess={() => { setShowAdd(false); void fetchRows(); }} onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null); }}>
          <div style={modalBox}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14 }}>Edit placement</h2>
            <PlacementForm edit={editTarget} onSuccess={() => { setEditTarget(null); void fetchRows(); }} onCancel={() => setEditTarget(null)} />
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete placement?"
          description={`Remove ${deleteTarget.name}'s placement at ${deleteTarget.company}?`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </Shell>
  );
}
