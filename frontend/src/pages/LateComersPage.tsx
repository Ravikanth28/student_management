import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { StudentActivityModal } from '../components/StudentActivityModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { LATE_PERIOD_LABELS, YEAR_OPTIONS, YEAR_LABELS, type LateListResponse, type LateRecord, type LateSummaryRow, type Student } from '../types';

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

export function LateComersPage({ onLogout }: Props) {
  const { success, error: toastError } = useToast();
  const [view, setView] = useState<'records' | 'summary'>('records');

  // ── Records view ──
  const [rows, setRows] = useState<LateRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(todayStr());
  const [period, setPeriod] = useState('');
  const [year, setYear] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // ── Delete / Clear All state ──
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LateListResponse>('/late-records', {
        params: { page, limit: LIMIT, date: date || undefined, period: period || undefined, year: year || undefined, q: q || undefined },
      });
      setRows(res.data.data);
      setTotal(res.data.meta.total);
    } catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, date, period, year, q]);

  // ── Summary view ──
  const [summary, setSummary] = useState<LateSummaryRow[]>([]);
  const [sFrom, setSFrom] = useState(monthStartStr());
  const [sTo, setSTo] = useState(todayStr());
  const [sYear, setSYear] = useState('');
  const [sQ, setSQ] = useState('');
  const [sLoading, setSLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setSLoading(true);
    try {
      const res = await api.get<{ data: LateSummaryRow[] }>('/late-records/summary', {
        params: { from: sFrom || undefined, to: sTo || undefined, year: sYear || undefined, q: sQ || undefined },
      });
      setSummary(res.data.data);
    } catch { setSummary([]); } finally { setSLoading(false); }
  }, [sFrom, sTo, sYear, sQ]);

  useEffect(() => { if (view === 'records') void fetchRows(); else void fetchSummary(); }, [view, fetchRows, fetchSummary]);

  const clearAllRecords = async () => {
    setClearing(true);
    try {
      const res = await api.delete<{ message: string; deleted: number }>('/late-records/all');
      success('Late records deleted', `Successfully cleared all ${res.data.deleted ?? ''} late record(s).`);
      setShowClearConfirm(false);
      if (view === 'records') void fetchRows(); else void fetchSummary();
    } catch {
      toastError('Clear failed', 'Could not delete late records.');
    } finally {
      setClearing(false);
    }
  };

  const deleteSingleRecord = async (id: number) => {
    setDeletingId(true);
    try {
      await api.delete(`/late-records/${id}`);
      success('Record deleted', 'Late record removed.');
      setDeleteTargetId(null);
      if (view === 'records') void fetchRows(); else void fetchSummary();
    } catch {
      toastError('Delete failed', 'Could not delete late record.');
    } finally {
      setDeletingId(false);
    }
  };

  // ── Per-student "View" popup ──
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [viewRecords, setViewRecords] = useState<LateRecord[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const openView = async (studentId: number) => {
    setViewOpen(true); setViewLoading(true); setViewStudent(null); setViewRecords([]);
    try {
      const [s, recs] = await Promise.all([
        api.get<Student>(`/students/${studentId}`),
        api.get<{ data: LateRecord[] }>(`/students/${studentId}/late-records`),
      ]);
      setViewStudent(s.data);
      setViewRecords(recs.data.data);
    } catch { /* ignore */ } finally { setViewLoading(false); }
  };
  const viewMinutes = viewRecords.reduce((t, r) => t + (r.minutes_late ?? 0), 0);

  const exportRecords = async () => {
    const res = await api.get<LateListResponse>('/late-records', { params: { page: 1, limit: 2000, date: date || undefined, period: period || undefined, q: q || undefined } });
    const header = ['Date', 'Period', 'Scheduled', 'Arrival', 'Minutes Late', 'Name', 'Register No', 'Enrollment No', 'Year', 'Section', 'Batch', 'Marked By'];
    const body = res.data.data.map((r) => [fmtDate(r.late_date), LATE_PERIOD_LABELS[r.period] ?? r.period, r.scheduled_time, r.late_time, r.minutes_late, r.name, r.register_number, r.enrollment_number, yearLabel(r.year), r.section, r.batch, r.marked_by].map(cell).join(','));
    download(`late-comers_${date || 'all'}.csv`, [header.join(','), ...body].join('\n'));
  };

  const exportSummary = () => {
    const header = ['Name', 'Register No', 'Year', 'Section', 'Batch', 'Morning', 'Morning break', 'Lunch', 'Evening break', 'Total lates', 'Total minutes'];
    const body = summary.map((r) => [r.name, r.register_number, yearLabel(r.year), r.section, r.batch, r.morning, r.morning_break, r.lunch, r.evening_break, r.total, r.total_minutes].map(cell).join(','));
    download(`late-summary_${sFrom}_to_${sTo}.csv`, [header.join(','), ...body].join('\n'));
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
      title="Late Comers"
      subtitle={view === 'records' ? 'Students marked late, by date and period' : 'Per-student late totals — most late first'}
      onLogout={onLogout}
      actions={
        <>
          {toggleBtn('records', 'Records')}
          {toggleBtn('summary', 'Summary')}
          <button className="btn btn-outline" onClick={() => (view === 'records' ? void exportRecords() : exportSummary())}>Export CSV</button>
          <button className="btn btn-outline" type="button" onClick={() => setShowClearConfirm(true)} style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>Clear All Records</button>
        </>
      }
    >
      {view === 'records' ? (
        <div className="card">
          <div className="toolbar">
            <input type="date" className="form-control" style={{ height: 40, maxWidth: 170 }} value={date} onChange={(e) => { setPage(1); setDate(e.target.value); }} />
            <select className="form-control" style={{ height: 40, maxWidth: 180 }} value={period} onChange={(e) => { setPage(1); setPeriod(e.target.value); }}>
              <option value="">All periods</option>
              {Object.entries(LATE_PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="form-control" style={{ height: 40, maxWidth: 140 }} value={year} onChange={(e) => { setPage(1); setYear(e.target.value); }}>
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
            </select>
            <input className="form-control" style={{ height: 40, flex: 1, minWidth: 160 }} placeholder="Search name / number…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
            {date && <button className="btn btn-outline btn-sm" onClick={() => { setPage(1); setDate(''); }}>All dates</button>}
          </div>

          {loading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}</div>
          ) : rows.length === 0 ? (
            <div className="empty-state"><p className="empty-title">No late records</p><p className="empty-sub">Nothing matches these filters.</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Period</th><th>Scheduled</th><th>Arrival</th><th>Late</th><th>Name</th><th>Register No.</th><th>Year</th><th>Section</th><th>Batch</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.late_date)}</td>
                      <td><span className="badge badge-amber">{LATE_PERIOD_LABELS[r.period] ?? r.period}</span></td>
                      <td className="td-muted">{r.scheduled_time ?? '—'}</td>
                      <td className="td-muted">{r.late_time ?? '—'}</td>
                      <td>{r.minutes_late == null ? '—' : <span className="badge badge-amber">{r.minutes_late} min</span>}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="td-muted">{r.register_number}</td>
                      <td>{yearLabel(r.year)}</td>
                      <td>{r.section}</td>
                      <td className="td-muted">{r.batch}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onClick={() => setDeleteTargetId(r.id)}
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
          <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={setPage} noun="records" />
        </div>
      ) : (
        <div className="card">
          <div className="toolbar" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              From <input type="date" className="form-control" style={{ height: 40, maxWidth: 160 }} value={sFrom} onChange={(e) => setSFrom(e.target.value)} />
            </label>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              To <input type="date" className="form-control" style={{ height: 40, maxWidth: 160 }} value={sTo} onChange={(e) => setSTo(e.target.value)} />
            </label>
            <select className="form-control" style={{ height: 40, maxWidth: 140 }} value={sYear} onChange={(e) => setSYear(e.target.value)}>
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
            </select>
            <input className="form-control" style={{ height: 40, flex: 1, minWidth: 160 }} placeholder="Search name / number…" value={sQ} onChange={(e) => setSQ(e.target.value)} />
          </div>

          {sLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}</div>
          ) : summary.length === 0 ? (
            <div className="empty-state"><p className="empty-title">No late records in this range</p><p className="empty-sub">Adjust the dates.</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>#</th><th>Name</th><th>Register No.</th><th>Year</th><th>Sec</th><th>Batch</th><th>Morning</th><th>M. break</th><th>Lunch</th><th>E. break</th><th>Total</th><th>Total min</th><th></th></tr></thead>
                <tbody>
                  {summary.map((r, i) => (
                    <tr key={r.student_id}>
                      <td className="td-muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="td-muted">{r.register_number}</td>
                      <td>{yearLabel(r.year)}</td>
                      <td>{r.section}</td>
                      <td className="td-muted">{r.batch}</td>
                      <td className="td-muted">{r.morning || '—'}</td>
                      <td className="td-muted">{r.morning_break || '—'}</td>
                      <td className="td-muted">{r.lunch || '—'}</td>
                      <td className="td-muted">{r.evening_break || '—'}</td>
                      <td><span className={`badge ${r.total >= 5 ? 'badge-amber' : 'badge-gray'}`}>{r.total}</span></td>
                      <td className="td-muted">{r.total_minutes}</td>
                      <td style={{ textAlign: 'right' }}><button className="btn btn-outline btn-sm" type="button" onClick={() => void openView(r.student_id)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewOpen && (
        <StudentActivityModal
          student={viewStudent}
          title="Late-comer history"
          loading={viewLoading}
          onClose={() => setViewOpen(false)}
          kpis={[
            { label: 'Total lates', value: viewRecords.length, tone: 'amber' },
            { label: 'Total minutes', value: viewMinutes, tone: 'amber' },
          ]}
        >
          {viewRecords.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>No late records.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Period</th><th>Scheduled</th><th>Arrival</th><th>Late</th></tr></thead>
                <tbody>
                  {viewRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.late_date)}</td>
                      <td><span className="badge badge-amber">{LATE_PERIOD_LABELS[r.period] ?? r.period}</span></td>
                      <td className="td-muted">{r.scheduled_time ?? '—'}</td>
                      <td className="td-muted">{r.late_time ?? '—'}</td>
                      <td>{r.minutes_late == null ? '—' : <span className="badge badge-amber">{r.minutes_late} min</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StudentActivityModal>
      )}

      {showClearConfirm && (
        <ConfirmModal
          title="Delete all late records?"
          description="Are you sure you want to delete ALL late comer records? This action cannot be undone."
          confirmLabel="Delete All Records"
          onConfirm={clearAllRecords}
          onCancel={() => setShowClearConfirm(false)}
          loading={clearing}
        />
      )}

      {deleteTargetId && (
        <ConfirmModal
          title="Delete this late record?"
          description="Are you sure you want to remove this late record?"
          confirmLabel="Delete Record"
          onConfirm={() => deleteSingleRecord(deleteTargetId)}
          onCancel={() => setDeleteTargetId(null)}
          loading={deletingId}
        />
      )}
    </Shell>
  );
}
