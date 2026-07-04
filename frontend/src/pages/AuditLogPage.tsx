import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { Pagination } from '../components/Pagination';
import type { AuditListResponse, AuditLog } from '../types';

type Props = { onLogout: () => void };

const LIMIT = 20;

// ─── Action → human label + badge colour ─────────────────────
const ACTION_META: Record<string, { label: string; color: string }> = {
  'auth.login':            { label: 'Login',         color: 'badge-navy' },
  'student.create':        { label: 'Create',        color: 'badge-green' },
  'student.update':        { label: 'Update',        color: 'badge-blue' },
  'student.delete':        { label: 'Delete',        color: 'badge-amber' },
  'student.photo.upload':  { label: 'Photo Upload',  color: 'badge-blue' },
  'student.photo.delete':  { label: 'Photo Delete',  color: 'badge-amber' },
  'import.bulk':           { label: 'Bulk Import',   color: 'badge-green' },
  'import.drive_photos':   { label: 'Drive Photos',  color: 'badge-green' },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, color: 'badge-gray' };
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function AuditLogPage({ onLogout }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AuditListResponse>('/system/audit', {
        params: { page, limit: LIMIT, action: action || undefined },
      });
      setLogs(res.data.data);
      setTotal(res.data.meta.total);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  // Load the distinct action list once for the filter dropdown.
  useEffect(() => {
    api.get<{ actions: string[] }>('/system/audit/actions')
      .then(res => setActions(res.data.actions))
      .catch(() => setActions([]));
  }, []);

  return (
    <Shell
      title="Audit Log"
      subtitle="Security and activity trail of every administrative action"
      onLogout={onLogout}
      actions={
        <>
          <select
            className="form-control"
            style={{ height: 38, flex: '1 1 150px', minWidth: 140, maxWidth: 240 }}
            value={action}
            onChange={e => { setPage(1); setAction(e.target.value); }}
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {actions.map(a => (
              <option key={a} value={a}>{actionMeta(a).label}</option>
            ))}
          </select>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => void fetchLogs()}>
            <IconRefresh />
            Refresh
          </button>
        </>
      }
    >
      <div className="card">
        {loading ? (
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><IconShield /></div>
            <p className="empty-title">No activity recorded</p>
            <p className="empty-sub">
              {action ? 'No events match this filter.' : 'Administrative actions will appear here as they happen.'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const meta = actionMeta(log.action);
                  return (
                    <tr key={log.id}>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{formatTime(log.created_at)}</td>
                      <td><span className={`badge ${meta.color}`}>{meta.label}</span></td>
                      <td>
                        <span className={`badge ${log.status === 'success' ? 'badge-green' : 'badge-amber'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.actor ?? '—'}</td>
                      <td className="td-muted">
                        {log.entity ? `${log.entity}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'}
                      </td>
                      <td className="td-muted" style={{ maxWidth: 320 }}>{log.details ?? '—'}</td>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{log.ip ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPage={setPage}
          noun="events"
        />
      </div>
    </Shell>
  );
}
