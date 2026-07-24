import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../state/auth';
import { useToast } from '../components/Toast';
import { Shell } from '../components/Shell';

function Spinner() {
  return (
    <div style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(0,0,0,0.15)', borderRadius: '50%', borderTopColor: 'var(--blue)', animation: 'spin 0.8s linear infinite' }} />
  );
}

export interface Circular {
  id: number;
  title: string;
  content: string;
  target_audience: string;
  priority: string;
  created_by: string;
  created_at: string;
}

function IconMegaphone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function fmtDate(d: string): string {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function CircularsPage({ onLogout }: { onLogout: () => void }) {
  const { role } = useAuth();
  const { success, error: toastError } = useToast();
  const canBroadcast = role === 'superadmin' || role === 'admin';

  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCircular, setSelectedCircular] = useState<Circular | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState('ALL');
  const [priority, setPriority] = useState('Normal');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCirculars = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ circulars: Circular[] }>('/circulars');
      setCirculars(res.data.circulars || []);
    } catch {
      toastError('Error', 'Failed to load circulars.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCirculars();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toastError('Validation Error', 'Title and Content are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/circulars', {
        title: title.trim(),
        content: content.trim(),
        target_audience: targetAudience,
        priority,
      });
      success('Broadcast Sent', 'Circular has been published successfully.');
      setTitle('');
      setContent('');
      setTargetAudience('ALL');
      setPriority('Normal');
      setShowModal(false);
      fetchCirculars();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not broadcast circular.';
      toastError('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this circular?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/circulars/${id}`);
      success('Deleted', 'Circular removed.');
      setCirculars((prev) => prev.filter((c) => c.id !== id));
      if (selectedCircular?.id === id) setSelectedCircular(null);
    } catch {
      toastError('Error', 'Failed to delete circular.');
    } finally {
      setDeletingId(null);
    }
  };

  const getPriorityBadgeClass = (p: string) => {
    if (p === 'Urgent') return 'badge badge-red';
    if (p === 'Important') return 'badge badge-amber';
    return 'badge badge-blue';
  };

  return (
    <Shell
      title="Circulars & Announcements"
      subtitle={canBroadcast ? 'Publish official notices to students and Class Representatives' : 'Official college notices and updates'}
      onLogout={onLogout}
      actions={
        canBroadcast ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
            <IconPlus /> Broadcast Circular
          </button>
        ) : null
      }
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
          <Spinner />
        </div>
      ) : circulars.length === 0 ? (
        <div className="card card-padded" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-3)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <IconMegaphone />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>No Circulars Yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', maxWidth: 400, margin: '0 auto' }}>
            {canBroadcast ? 'Click "Broadcast Circular" above to send an official notice to all CRs and students.' : 'Official notices and announcements from administration will appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {circulars.map((item) => (
            <div
              key={item.id}
              className="card card-padded"
              onClick={() => setSelectedCircular(item)}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                borderColor: 'var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--blue)';
                e.currentTarget.style.boxShadow = 'var(--shadow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className={getPriorityBadgeClass(item.priority)}>{item.priority}</span>
                  <span className="badge badge-gray">Audience: {item.target_audience}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{fmtDate(item.created_at)}</span>
                </div>
                {canBroadcast && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    style={{ color: 'var(--red)', borderColor: 'rgba(220,38,38,0.2)' }}
                    title="Delete Circular"
                  >
                    {deletingId === item.id ? <Spinner /> : <IconTrash />} Delete
                  </button>
                )}
              </div>

              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: '4px 0 12px', lineHeight: 1.3 }}>
                {item.title}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-3)' }}>
                <span>Published by <strong>{item.created_by}</strong></span>
                <span style={{ color: 'var(--blue)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Read Full Notice →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Circular View Modal */}
      {selectedCircular && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setSelectedCircular(null); }}>
          <div style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: '28px 32px', position: 'relative', maxHeight: 'calc(100dvh - 60px)', overflowY: 'auto' }}>
            {/* Header branding */}
            <div style={{ textAlign: 'center', paddingBottom: 16, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--blue)', textTransform: 'uppercase' }}>
                COLLEGE ADMINISTRATION · OFFICIAL ANNOUNCEMENT
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: '4px 0 0' }}>
                Sri Manakula Vinayagar Engineering College
              </h3>
            </div>

            {/* Metadata Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={getPriorityBadgeClass(selectedCircular.priority)}>{selectedCircular.priority}</span>
                <span className="badge badge-gray">Audience: {selectedCircular.target_audience}</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 600 }}>
                {fmtDate(selectedCircular.created_at)}
              </span>
            </div>

            {/* Notice Subject / Title */}
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginTop: 0, marginBottom: 16, lineHeight: 1.35 }}>
              {selectedCircular.title}
            </h1>

            {/* Full Message Body */}
            <div style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 24, padding: '16px 0' }}>
              {selectedCircular.content}
            </div>

            {/* Footer Publisher */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
                Issued by: <strong>{selectedCircular.created_by}</strong>
              </div>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedCircular(null)}>
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal for Admin & Superadmin */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ width: '100%', maxWidth: 540, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: 24 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', marginTop: 0, marginBottom: 16 }}>
              Broadcast New Circular
            </h2>

            <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Notice Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Mid-term Exam Schedule & Attendance Requirement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="Normal">Normal</option>
                    <option value="Important">Important</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Audience</label>
                  <select className="form-control" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}>
                    <option value="ALL">All Students & CRs</option>
                    <option value="1st Year">1st Year Students</option>
                    <option value="2nd Year">2nd Year Students</option>
                    <option value="3rd Year">3rd Year Students</option>
                    <option value="4th Year">4th Year Students</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Message / Content *</label>
                <textarea
                  className="form-control"
                  rows={5}
                  placeholder="Type the full official announcement message here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Publishing...' : 'Publish Circular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
