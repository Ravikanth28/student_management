import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { LATE_PERIOD_LABELS, type LateListResponse, type LateRecord, type LateSummaryRow } from '../types';

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
  const [view, setView] = useState<'records' | 'summary'>('records');

  // ── Records view ──
  const [rows, setRows] = useState<LateRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(todayStr());
  const [period, setPeriod] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LateListResponse>('/late-records', {
        params: { page, limit: LIMIT, date: date || undefined, period: period || undefined, q: q || undefined },
      });
      setRows(res.data.data);
      setTotal(res.data.meta.total);
    } catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, date, period, q]);

  // ── Summary view ──
  const [summary, setSummary] = useState<LateSummaryRow[]>([]);
  const [sFrom, setSFrom] = useState(monthStartStr());
  const [sTo, setSTo] = useState(todayStr());
  const [sQ, setSQ] = useState('');
  const [sLoading, setSLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setSLoading(true);
    try {
      const res = await api.get<{ data: LateSummaryRow[] }>('/late-records/summary', {
        params: { from: sFrom || undefined, to: sTo || undefined, q: sQ || undefined },
      });
      setSummary(res.data.data);
    } catch { setSummary([]); } finally { setSLoading(false); }
  }, [sFrom, sTo, sQ]);

  useEffect(() => { if (view === 'records') void fetchRows(); else void fetchSummary(); }, [view, fetchRows, fetchSummary]);

  const exportRecords = async () => {
    const res = await api.get<LateListResponse>('/late-records', { params: { page: 1, limit: 2000, date: date || undefined, period: period || undefined, q: q || undefined } });
    const header = ['Date', 'Period', 'Scheduled', 'Arrival', 'Minutes Late', 'Name', 'Register No', 'Enrollment No', 'Section', 'Batch', 'Marked By'];
    const body = res.data.data.map((r) => [fmtDate(r.late_date), LATE_PERIOD_LABELS[r.period] ?? r.period, r.scheduled_time, r.late_time, r.minutes_late, r.name, r.register_number, r.enrollment_number, r.section, r.batch, r.marked_by].map(cell).join(','));
    download(`late-comers_${date || 'all'}.csv`, [header.join(','), ...body].join('\n'));
  };

  const exportSummary = () => {
    const header = ['Name', 'Register No', 'Section', 'Batch', 'Morning', 'Morning break', 'Lunch', 'Evening break', 'Total lates', 'Total minutes'];
    const body = summary.map((r) => [r.name, r.register_number, r.section, r.batch, r.morning, r.morning_break, r.lunch, r.evening_break, r.total, r.total_minutes].map(cell).join(','));
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
                <thead><tr><th>Date</th><th>Period</th><th>Scheduled</th><th>Arrival</th><th>Late</th><th>Name</th><th>Register No.</th><th>Section</th><th>Batch</th></tr></thead>
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
                      <td>{r.section}</td>
                      <td className="td-muted">{r.batch}</td>
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
            <input className="form-control" style={{ height: 40, flex: 1, minWidth: 160 }} placeholder="Search name / number…" value={sQ} onChange={(e) => setSQ(e.target.value)} />
          </div>

          {sLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}</div>
          ) : summary.length === 0 ? (
            <div className="empty-state"><p className="empty-title">No late records in this range</p><p className="empty-sub">Adjust the dates.</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>#</th><th>Name</th><th>Register No.</th><th>Sec</th><th>Batch</th><th>Morning</th><th>M. break</th><th>Lunch</th><th>E. break</th><th>Total</th><th>Total min</th></tr></thead>
                <tbody>
                  {summary.map((r, i) => (
                    <tr key={r.student_id}>
                      <td className="td-muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="td-muted">{r.register_number}</td>
                      <td>{r.section}</td>
                      <td className="td-muted">{r.batch}</td>
                      <td className="td-muted">{r.morning || '—'}</td>
                      <td className="td-muted">{r.morning_break || '—'}</td>
                      <td className="td-muted">{r.lunch || '—'}</td>
                      <td className="td-muted">{r.evening_break || '—'}</td>
                      <td><span className={`badge ${r.total >= 5 ? 'badge-amber' : 'badge-gray'}`}>{r.total}</span></td>
                      <td className="td-muted">{r.total_minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
