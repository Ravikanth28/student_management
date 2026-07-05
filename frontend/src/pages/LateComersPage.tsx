import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { LATE_PERIOD_LABELS, type LateListResponse, type LateRecord } from '../types';

type Props = { onLogout: () => void };
const LIMIT = 50;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string): string {
  const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toCsv(rows: LateRecord[]): string {
  const header = ['Date', 'Period', 'Scheduled', 'Arrival', 'Minutes Late', 'Name', 'Register No', 'Enrollment No', 'Section', 'Batch', 'Marked By'];
  const body = rows.map((r) => [
    fmtDate(r.late_date), LATE_PERIOD_LABELS[r.period] ?? r.period, r.scheduled_time ?? '', r.late_time ?? '',
    r.minutes_late ?? '', r.name ?? '', r.register_number ?? '', r.enrollment_number ?? '', r.section ?? '', r.batch ?? '', r.marked_by ?? '',
  ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...body].join('\n');
}

export function LateComersPage({ onLogout }: Props) {
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
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, date, period, q]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const exportCsv = async () => {
    const res = await api.get<LateListResponse>('/late-records', {
      params: { page: 1, limit: 2000, date: date || undefined, period: period || undefined, q: q || undefined },
    });
    const blob = new Blob([toCsv(res.data.data)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `late-comers_${date || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell
      title="Late Comers"
      subtitle="Students marked late, by date and period"
      onLogout={onLogout}
      actions={<button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>}
    >
      <div className="card">
        {/* Filters */}
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
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p className="empty-title">No late records</p><p className="empty-sub">Nothing matches these filters.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Date</th><th>Period</th><th>Scheduled</th><th>Arrival</th><th>Late</th><th>Name</th><th>Register No.</th><th>Section</th><th>Batch</th></tr>
              </thead>
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
    </Shell>
  );
}
