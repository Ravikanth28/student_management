import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { DISCIPLINE_REASONS, YEAR_OPTIONS, YEAR_LABELS, type DisciplineListResponse, type DisciplineRecord, type DisciplineSummaryRow } from '../types';

const yearLabel = (y?: string | null) => (y ? (YEAR_LABELS[y] ?? y) : '—');

type Props = { onLogout: () => void };
const LIMIT = 50;

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => `${new Date().toISOString().slice(0, 7)}-01`;

function fmtDate(d: string): string {
  const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
const cell = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`;

export function DisciplinaryPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [view, setView] = useState<'records' | 'summary'>('records');

  // ── Records view ──
  const [rows, setRows] = useState<DisciplineRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [year, setYear] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<DisciplineRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DisciplineListResponse>('/discipline-records', {
        params: { page, limit: LIMIT, date: date || undefined, reason: reason || undefined, year: year || undefined, q: q || undefined },
      });
      setRows(res.data.data);
      setTotal(res.data.meta.total);
    } catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, date, reason, year, q]);

  // ── Summary view ──
  const [summary, setSummary] = useState<DisciplineSummaryRow[]>([]);
  const [sFrom, setSFrom] = useState(monthStartStr());
  const [sTo, setSTo] = useState(todayStr());
  const [sYear, setSYear] = useState('');
  const [sQ, setSQ] = useState('');
  const [sLoading, setSLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setSLoading(true);
    try {
      const res = await api.get<{ data: DisciplineSummaryRow[] }>('/discipline-records/summary', {
        params: { from: sFrom || undefined, to: sTo || undefined, year: sYear || undefined, q: sQ || undefined },
      });
      setSummary(res.data.data);
    } catch { setSummary([]); } finally { setSLoading(false); }
  }, [sFrom, sTo, sYear, sQ]);

  useEffect(() => {
    if (view === 'records') void fetchRows(); else void fetchSummary();
  }, [view, fetchRows, fetchSummary]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/discipline-records/${deleteTarget.id}`);
      success('Record deleted', 'Discipline record has been removed.');
      setDeleteTarget(null);
      void fetchRows();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError('Delete failed', msg ?? 'Could not delete record.');
    } finally {
      setDeleting(false);
    }
  };

  const exportRecords = async () => {
    const res = await api.get<DisciplineListResponse>('/discipline-records', {
      params: { page: 1, limit: 2000, date: date || undefined, reason: reason || undefined, year: year || undefined, q: q || undefined },
    });
    const header = ['Date', 'Time', 'Reason', 'Details', 'Name', 'Register No', 'Enrollment No', 'Department', 'Year', 'Section', 'Batch', 'Marked By'];
    const body = res.data.data.map((r) => [
      fmtDate(r.record_date),
      r.record_time ?? '—',
      r.reason,
      r.details ?? '',
      r.name,
      r.register_number,
      r.enrollment_number,
      r.department,
      yearLabel(r.year),
      r.section,
      r.batch,
      r.marked_by,
    ].map(cell).join(','));
    download(`disciplinary-records_${date || 'all'}.csv`, [header.join(','), ...body].join('\n'));
  };

  const exportSummary = () => {
    const header = ['Name', 'Register No', 'Year', 'Section', 'Batch', 'Total Violations', 'Issues / Reasons'];
    const body = summary.map((r) => [
      r.name,
      r.register_number,
      yearLabel(r.year),
      r.section,
      r.batch,
      r.total,
      r.reasons,
    ].map(cell).join(','));
    download(`disciplinary-summary_${sFrom}_to_${sTo}.csv`, [header.join(','), ...body].join('\n'));
  };

  const toggleBtn = (v: 'records' | 'summary', text: string) => (
    <button
      type="button"
      className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-outline'}`}
      onClick={() => setView(v)}
    >{text}</button>
  );

  return (
    <Shell
      title="Disciplinary Records"
      subtitle={view === 'records' ? 'All student discipline entries, violations, and details' : 'Aggregate per-student discipline violations report'}
      onLogout={onLogout}
      actions={
        <>
          {toggleBtn('records', 'Records')}
          {toggleBtn('summary', 'Summary')}
          <button className="btn btn-outline" onClick={() => (view === 'records' ? void exportRecords() : exportSummary())}>Export CSV</button>
        </>
      }
    >
      {view === 'records' ? (
        <div className="card">
          <div className="toolbar">
            <input type="date" className="form-control" style={{ height: 40, maxWidth: 170 }} value={date} onChange={(e) => { setPage(1); setDate(e.target.value); }} />
            <select className="form-control" style={{ height: 40, maxWidth: 190 }} value={reason} onChange={(e) => { setPage(1); setReason(e.target.value); }}>
              <option value="">All Issues / Reasons</option>
              {DISCIPLINE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="form-control" style={{ height: 40, maxWidth: 140 }} value={year} onChange={(e) => { setPage(1); setYear(e.target.value); }}>
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
            </select>
            <input className="form-control" style={{ height: 40, flex: 1, minWidth: 160 }} placeholder="Search student name / register no / reason…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
            {(date || reason || year || q) && (
              <button className="btn btn-outline btn-sm" onClick={() => { setPage(1); setDate(''); setReason(''); setYear(''); setQ(''); }}>
                Clear Filters
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No disciplinary records</p>
              <p className="empty-sub">No discipline violations logged matching these criteria.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Student Name</th>
                    <th>Reg Number</th>
                    <th>Year / Sec</th>
                    <th>Issue / Reason</th>
                    <th>Remarks / Details</th>
                    <th>Logged By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{fmtDate(r.record_date)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{r.record_time ?? '—'}</div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ fontWeight: 700, textAlign: 'left' }}
                          onClick={() => navigate(`/students/${r.student_id}`)}
                        >
                          {r.name}
                        </button>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{r.department} ({r.batch})</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.register_number}</td>
                      <td>{yearLabel(r.year)} · Sec {r.section}</td>
                      <td>
                        <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          ⚠️ {r.reason}
                        </span>
                      </td>
                      <td style={{ maxWidth: 220, color: 'var(--text-2)', fontSize: '0.85rem' }}>
                        {r.details || '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{r.marked_by ?? 'system'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--red)', borderColor: 'var(--border)' }}
                          onClick={() => setDeleteTarget(r)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={setPage} noun="records" />
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)' }}>From:</span>
              <input type="date" className="form-control" style={{ height: 40, maxWidth: 150 }} value={sFrom} onChange={(e) => setSFrom(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)' }}>To:</span>
              <input type="date" className="form-control" style={{ height: 40, maxWidth: 150 }} value={sTo} onChange={(e) => setSTo(e.target.value)} />
            </div>
            <select className="form-control" style={{ height: 40, maxWidth: 140 }} value={sYear} onChange={(e) => setSYear(e.target.value)}>
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
            </select>
            <input className="form-control" style={{ height: 40, flex: 1, minWidth: 160 }} placeholder="Search student name / register no…" value={sQ} onChange={(e) => setSQ(e.target.value)} />
          </div>

          {sLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
            </div>
          ) : summary.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No summary records</p>
              <p className="empty-sub">No discipline violations recorded within this date range.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Register Number</th>
                    <th>Year / Section</th>
                    <th>Batch</th>
                    <th style={{ textAlign: 'center' }}>Total Violations</th>
                    <th>Types of Violations</th>
                    <th style={{ textAlign: 'right' }}>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((r) => (
                    <tr key={r.student_id}>
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ fontWeight: 700, textAlign: 'left' }}
                          onClick={() => navigate(`/students/${r.student_id}`)}
                        >
                          {r.name}
                        </button>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.register_number}</td>
                      <td>{yearLabel(r.year)} · Sec {r.section}</td>
                      <td>{r.batch}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-amber" style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                          {r.total}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
                        {r.reasons || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/students/${r.student_id}`)}
                        >
                          View Student
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Disciplinary Record"
          description={`Are you sure you want to delete the discipline entry "${deleteTarget.reason}" for ${deleteTarget.name}?`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete Record'}
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Shell>
  );
}
