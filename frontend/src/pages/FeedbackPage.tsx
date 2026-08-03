import { useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ActivityTabs } from '../components/ActivityTabs';
import { useToast } from '../components/Toast';
import { useAuth } from '../state/auth';
import { isSuperadmin } from '../lib/roles';
import { proxiedImage } from '../lib/img';
import { YEAR_LABELS, type Feedback } from '../types';
function FeedbackModal({ f, onClose }: { f: Feedback, onClose: () => void }) {
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 600, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', position: 'relative', maxHeight: 'calc(100dvh - 60px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, zIndex: 10, boxShadow: 'var(--shadow-xs)' }}
          aria-label="Close modal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div style={{ background: 'var(--surface-2)', padding: '32px 32px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginTop: 0, marginBottom: 24 }}>
            Student Feedback
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {f.photo_url && proxiedImage(f.photo_url) ? (
              <img src={proxiedImage(f.photo_url)!} alt={f.student_name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--surface)', boxShadow: 'var(--shadow-sm)' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue), var(--blue-hover))', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '1.5rem', border: '3px solid var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                {f.student_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text)' }}>{f.student_name}</div>
              <div style={{ color: 'var(--text-2)', fontSize: '0.9rem', fontWeight: 500, marginTop: 2 }}>{f.register_number}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>
                {f.department} · {f.year ? `${YEAR_LABELS[f.year] ?? f.year} ` : ''}{f.section} section
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '32px', background: 'var(--surface)', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Submitted on {fmtDate(f.created_at)}
          </div>
          
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text)', lineHeight: 1.7, fontSize: '1.05rem', background: 'var(--bg)', padding: '24px', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--blue)' }}>
            {f.content}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedbackPage({ onLogout }: { onLogout: () => void }) {
  const { role } = useAuth();
  const { success, error: toastError } = useToast();
  const superadmin = isSuperadmin(role);

  // Student state
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Superadmin state
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(superadmin);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let active = true;
    if (superadmin) {
      api.get<{ data: Feedback[] }>('/feedback')
        .then((res) => { if (active) setFeedbackList(res.data.data); })
        .catch(() => { if (active) toastError('Error', 'Could not load feedback.'); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [superadmin, toastError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/feedback', { content });
      success('Feedback Sent', 'Thank you for your feedback!');
      setContent('');
    } catch {
      toastError('Submission failed', 'Could not send feedback at this time.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  return (
    <Shell
      title="Activity"
      tabs={<ActivityTabs />}
      subtitle={superadmin ? "Review student feedback" : "We value your thoughts and suggestions"}
      onLogout={onLogout}
    >
      {superadmin ? (
        // Superadmin View
        <div className="card card-padded">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Student Feedback</h3>
          {loading ? (
            <p style={{ color: 'var(--text-3)' }}>Loading...</p>
          ) : feedbackList.length === 0 ? (
            <p style={{ color: 'var(--text-3)' }}>No feedback submitted yet.</p>
          ) : (
            <div className="table-container" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Year</th>
                    <th>Sec</th>
                    <th>Enrollment</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackList.map(f => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {f.photo_url && proxiedImage(f.photo_url) ? (
                            <img src={proxiedImage(f.photo_url)!} alt={f.student_name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #4f7cc7, #2a4f7c)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                              {f.student_name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div>{f.student_name}</div>
                            {f.department && <div className="td-muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>{f.department}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{f.year ? `${YEAR_LABELS[f.year] ?? f.year}` : '—'}</td>
                      <td>{f.section || '—'}</td>
                      <td className="td-muted">{f.register_number}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setSelectedFeedback(f)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedFeedback && (
            <FeedbackModal f={selectedFeedback} onClose={() => setSelectedFeedback(null)} />
          )}
        </div>
      ) : role === 'student' ? (
        // Student View
        <div className="card card-padded" style={{ maxWidth: 600 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Submit Feedback</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-3)', marginBottom: 20 }}>
            Share your suggestions, report issues, or tell us what we can improve. Your feedback is sent securely to the administration.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Your Feedback</label>
              <textarea 
                className="form-control" 
                rows={6} 
                placeholder="Type your feedback here..." 
                value={content}
                onChange={e => setContent(e.target.value)}
                required
                disabled={submitting}
                style={{ resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !content.trim()}>
              {submitting ? 'Sending...' : 'Send Feedback'}
            </button>
          </form>
        </div>
      ) : (
        // Other roles (admin, user) - Should not happen if paths are restricted
        <div className="card card-padded">
          <p style={{ color: 'var(--text-3)' }}>You do not have permission to view this page.</p>
        </div>
      )}
    </Shell>
  );
}
