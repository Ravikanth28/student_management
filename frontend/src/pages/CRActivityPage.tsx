import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { YEAR_OPTIONS, YEAR_LABELS } from '../types';

export interface CRActivityRecord {
  id: number;
  submitted_at: string;
  att_date: string;
  year: string;
  section: string;
  absent_count: number;
  absent_names: string | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
}

const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

function formatDateTime(dtStr: string): string {
  const dt = new Date(dtStr.includes('T') ? dtStr : `${dtStr}Z`);
  if (isNaN(dt.getTime())) return dtStr;
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateOnly(dStr: string): string {
  const dt = new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
  if (isNaN(dt.getTime())) return dStr;
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function CRActivityPage({ onLogout }: { onLogout: () => void }) {
  const { error: toastError } = useToast();
  const [logs, setLogs] = useState<CRActivityRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [yearFilter, setYearFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CRActivityRecord[]; meta: { total: number } }>('/cr-activity', {
        params: {
          page,
          limit,
          year: yearFilter || undefined,
          section: sectionFilter || undefined,
        },
      });
      setLogs(res.data.data);
      setTotal(res.data.meta.total);
    } catch {
      toastError('Error', 'Failed to load CR activity logs.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, yearFilter, sectionFilter, toastError]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Shell
      title="CR Activity Log"
      subtitle="Track devices, timestamps, and absent submissions made by Class Representatives"
      onLogout={onLogout}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Filters */}
        <div className="card card-padded" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
              Academic Year
            </label>
            <select
              className="form-control"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {YEAR_LABELS[y]}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>
              Section
            </label>
            <select
              className="form-control"
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Sections</option>
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  Sec {s}
                </option>
              ))}
            </select>
          </div>

          {(yearFilter || sectionFilter) && (
            <div style={{ alignSelf: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setYearFilter('');
                  setSectionFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Logs Table */}
        <div className="card card-padded">
          {loading ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          ) : logs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No CR activity recorded yet.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Submitted At</th>
                    <th>Class</th>
                    <th>Attendance Date</th>
                    <th>Device & IP Info</th>
                    <th>Absentees</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{formatDateTime(log.submitted_at)}</td>
                      <td>
                        <span className="badge badge-blue">
                          {YEAR_LABELS[log.year] ?? log.year} - Sec {log.section}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{formatDateOnly(log.att_date)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                            {log.browser ?? 'Unknown Browser'} on {log.os ?? 'Unknown OS'}
                          </span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text-3)', fontSize: '0.76rem' }}>
                            IP: {log.ip_address === '::1' ? '127.0.0.1 (Localhost)' : log.ip_address ?? 'Unknown'} {log.device_type ? `• ${log.device_type}` : ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-red" style={{ fontWeight: 700 }}>
                          {log.absent_count} Absent
                        </span>
                      </td>
                      <td>
                        {log.absent_names ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                            onClick={() => toggleExpand(log.id)}
                          >
                            {expandedId === log.id ? 'Hide Names' : 'View Names'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Expandable Names Modal/Drawer inside Row */}
          {expandedId !== null && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--bg-2, rgba(255,255,255,0.03))',
                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                <strong style={{ fontSize: '0.85rem' }}>Marked Absent Students:</strong>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => setExpandedId(null)}
                >
                  Close
                </button>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
                {logs.find((l) => l.id === expandedId)?.absent_names}
              </p>
            </div>
          )}

          {total > limit && (
            <div style={{ marginTop: 16 }}>
              <Pagination page={page} totalPages={Math.ceil(total / limit)} total={total} limit={limit} onPage={setPage} noun="logs" />
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
