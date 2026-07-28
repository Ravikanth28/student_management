import { useCallback, useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { YEAR_LABELS } from '../types';
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
  const [rYear, setRYear] = useState('');
  const [rBatch, setRBatch] = useState('');
  const [rFrom, setRFrom] = useState('');
  const [rTo, setRTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Placement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Placement | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Multi-select batch delete state ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<number[] | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const deleteBatchRecords = async () => {
    if (!batchDeleteTarget || batchDeleteTarget.length === 0) return;
    setBatchDeleting(true);
    try {
      const res = await api.post<{ message: string; count: number }>('/placements/batch-delete', { ids: batchDeleteTarget });
      success('Placements deleted', `Successfully deleted ${res.data.count} placement(s).`);
      setBatchDeleteTarget(null);
      setSelectedIds(new Set());
      void fetchRows();
    } catch {
      toastError('Delete failed', 'Could not delete selected placements.');
    } finally {
      setBatchDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PlacementListResponse>('/placements', { 
        params: { 
          page, 
          limit: LIMIT, 
          q: q || undefined,
          year: rYear || undefined,
          batch: rBatch || undefined,
          fromDate: rFrom || undefined,
          toDate: rTo || undefined
        } 
      });
      setRows(res.data.data);
      setTotal(res.data.meta.total);
    } catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, q, rYear, rBatch, rFrom, rTo]);

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

  const fetchAllRecordsForExport = async () => {
    try {
      const res = await api.get<PlacementListResponse>('/placements', { 
        params: { limit: 10000, q: q || undefined, year: rYear || undefined, batch: rBatch || undefined, fromDate: rFrom || undefined, toDate: rTo || undefined } 
      });
      return res.data.data;
    } catch {
      toastError('Export failed', 'Could not fetch records.');
      return [];
    }
  };

  const exportRecordsCSV = async () => {
    const allRows = await fetchAllRecordsForExport();
    if (!allRows.length) return;
    
    const headers = ['Student', 'Register No.', 'Company', 'Position', 'Package', 'Type', 'Offer', 'Date'];
    const csvRows = [headers.join(',')];
    
    allRows.forEach((p) => {
      const row = [
        `"${(p.name ?? '').replace(/"/g, '""')}"`,
        p.register_number ?? '',
        `"${p.company.replace(/"/g, '""')}"`,
        `"${(p.position ?? '').replace(/"/g, '""')}"`,
        `"${(p.package ?? '').replace(/"/g, '""')}"`,
        PLACEMENT_TYPE_LABELS[p.placement_type] ?? p.placement_type,
        p.offer_type ? OFFER_TYPE_LABELS[p.offer_type] ?? p.offer_type : '-',
        fmtDate(p.placed_date)
      ];
      csvRows.push(row.join(','));
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Placements_Records.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRecordsPDF = async () => {
    const allRows = await fetchAllRecordsForExport();
    if (!allRows.length) return;
    
    const doc = new jsPDF('landscape');
    const title = 'Placements Records';
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    const filters = [];
    if (rYear) filters.push(`Year: ${YEAR_LABELS[rYear] ?? rYear}`);
    if (rBatch) filters.push(`Batch: ${rBatch}`);
    if (rFrom || rTo) filters.push(`Date: ${rFrom || '...'} to ${rTo || '...'}`);
    if (q) filters.push(`Search: ${q}`);
    
    if (filters.length > 0) {
      doc.text(`Filters applied: ${filters.join(' | ')}`, 14, 22);
    }
    
    autoTable(doc, {
      startY: filters.length > 0 ? 26 : 22,
      head: [['Student', 'Register No.', 'Company', 'Position', 'Package', 'Type', 'Date']],
      body: allRows.map((p) => [
        p.name ?? '',
        p.register_number ?? '',
        p.company,
        p.position ?? '-',
        p.package ?? '-',
        PLACEMENT_TYPE_LABELS[p.placement_type] ?? p.placement_type,
        fmtDate(p.placed_date)
      ]),
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 },
    });
    
    doc.save('Placements_Records.pdf');
  };

  return (
    <Shell
      title="Placements"
      subtitle="Company offers — on & off campus"
      onLogout={onLogout}
      actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add placement</button>}
    >
      <div className="card">
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
          <input className="form-control" style={{ height: 40, flex: 1, minWidth: 180 }} placeholder="Search company / student…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
          <select className="form-control" style={{ height: 40, width: 120 }} value={rYear} onChange={(e) => { setPage(1); setRYear(e.target.value); }}>
            <option value="">All Years</option>
            <option value="I">I Year</option>
            <option value="II">II Year</option>
            <option value="III">III Year</option>
            <option value="IV">IV Year</option>
          </select>
          <input className="form-control" style={{ height: 40, width: 120 }} placeholder="Batch" value={rBatch} onChange={(e) => { setPage(1); setRBatch(e.target.value); }} />
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-outline" style={{ height: 40 }} onClick={exportRecordsCSV}>CSV</button>
            <button className="btn btn-outline" style={{ height: 40 }} onClick={exportRecordsPDF}>PDF</button>
          </div>
        </div>

        {rows.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '10px 14px', margin: '0 16px 12px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>
              {selectedIds.size > 0 ? (
                <span><strong>{selectedIds.size}</strong> placement(s) selected</span>
              ) : (
                <span style={{ color: 'var(--text-2)' }}>Select placements below to delete them in bulk</span>
              )}
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={selectedIds.size === 0}
              style={{ background: selectedIds.size > 0 ? '#dc2626' : undefined, borderColor: selectedIds.size > 0 ? '#dc2626' : undefined }}
              onClick={() => setBatchDeleteTarget([...selectedIds])}
            >
              Delete Selected ({selectedIds.size})
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p className="empty-title">No placements yet</p><p className="empty-sub">Add one, or record via the Scanner.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === rows.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Student</th><th>Register No.</th><th>Company</th><th>Position</th><th>Package</th><th>Type</th><th>Offer</th><th>Date</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <tr key={p.id} style={{ background: isSelected ? 'rgba(239, 68, 68, 0.06)' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectId(p.id)}
                        />
                      </td>
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
                  );
                })}
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

      {batchDeleteTarget && (
        <ConfirmModal
          title={`Delete ${batchDeleteTarget.length} placement(s)?`}
          description={`Are you sure you want to delete ${batchDeleteTarget.length} selected placement(s)?`}
          confirmLabel="Delete Selected"
          onConfirm={deleteBatchRecords}
          onCancel={() => setBatchDeleteTarget(null)}
          loading={batchDeleting}
        />
      )}
    </Shell>
  );
}
