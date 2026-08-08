import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../state/auth';
import { useToast } from '../components/Toast';
import { Shell } from '../components/Shell';
import { ActivityTabs } from '../components/ActivityTabs';
import { proxiedImage } from '../lib/img';

interface Feedback {
  id: number;
  content: string;
  student_name?: string;
  student_department?: string;
  student_batch?: string;
  student_enrollment_number?: string;
  student_photo?: string;
  created_at: string;
  staff_reply?: string | null;
  status?: string;
  staff_name?: string;
  staff_department?: string;
  staff_photo?: string;
}

interface FeedbackMessage {
  id: number;
  sender_type: string;
  sender_id: number | null;
  message: string;
  created_at: string;
}

interface StaffOption {
  id: number;
  name: string;
  department: string | null;
  emp_id: string;
}

export function FeedbackPage({ onLogout }: { onLogout: () => void }) {
  const { role } = useAuth();
  
  if (role === 'student') return <StudentFeedbackView onLogout={onLogout} />;
  if (role === 'superadmin') return <SuperadminFeedbackView onLogout={onLogout} />;
  return <TeacherFeedbackView onLogout={onLogout} />;
}

// ─── Student View ──────────────────────────────────────────────────
function StudentFeedbackView({ onLogout }: { onLogout: () => void }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { success, error: toastError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/feedback', { content });
      success('Submitted', 'Your feedback has been sent securely.');
      setContent('');
    } catch {
      toastError('Error', 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell title="Activity" subtitle="We value your thoughts and suggestions" onLogout={onLogout}>
      <ActivityTabs />
      <div style={{ width: '100%', marginTop: '32px' }}>
        <div style={{ maxWidth: '500px' }}>
          <div className="card card-padded" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: 8, fontWeight: 600 }}>Submit Feedback</h2>
            <p style={{ color: 'var(--text-2)', marginBottom: 24, fontSize: '0.9rem', lineHeight: 1.5 }}>
              Share your suggestions, report issues, or tell us what we can improve. Your feedback is sent securely to the administration.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: 8, display: 'block' }}>Your Feedback</label>
                <textarea
                  className="form-control"
                  rows={7}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your feedback here..."
                  required
                  style={{ resize: 'vertical', background: 'var(--surface)' }}
                />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%', padding: '12px' }} disabled={submitting || !content.trim()}>
                {submitting ? 'Submitting...' : 'Send Feedback'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─── Superadmin View ────────────────────────────────────────────────
function SuperadminFeedbackView({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'student' | 'staff'>('student');
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [repliedFeedbacks, setRepliedFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { success, error: toastError } = useToast();

  const loadFeedbacks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Feedback[]>('/feedback/pending');
      setFeedbacks(data);
    } catch {
      toastError('Error', 'Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  const loadRepliedFeedbacks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Feedback[]>('/feedback/replied');
      setRepliedFeedbacks(data);
    } catch {
      toastError('Error', 'Failed to load staff feedback.');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const { data } = await api.get<StaffOption[]>('/feedback/staff-list');
      setStaffList(data);
    } catch {
      toastError('Error', 'Failed to load staff list.');
    }
  };

  useEffect(() => {
    if (activeTab === 'student') {
      loadFeedbacks();
      loadStaff();
    } else {
      loadRepliedFeedbacks();
    }
  }, [activeTab]);

  const [viewModal, setViewModal] = useState<Feedback | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [rowSelections, setRowSelections] = useState<Record<number, string>>({});
  const [replyText, setReplyText] = useState('');

  const handleView = async (f: Feedback) => {
    setViewModal(f);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const { data } = await api.get<FeedbackMessage[]>(`/feedback/${f.id}/messages`);
      setMessages(data);
    } catch {
      toastError('Error', 'Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    if (!viewModal || !replyText.trim()) return;
    try {
      await api.post(`/feedback/${viewModal.id}/messages`, { message: replyText });
      success('Sent', 'Message sent successfully.');
      setReplyText('');
      handleView(viewModal);
    } catch {
      toastError('Error', 'Failed to send message.');
    }
  };

  const handleRowSelection = (feedbackId: number, staffId: string) => {
    setRowSelections(prev => ({ ...prev, [feedbackId]: staffId }));
  };

  const handleForwardInline = async (f: Feedback) => {
    const staffId = rowSelections[f.id];
    if (!staffId) {
      toastError('Error', 'Please select a teacher to forward to.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/feedback/${f.id}/forward`, { staff_id: parseInt(staffId, 10) });
      success('Forwarded', 'Feedback assigned to teacher successfully.');
      loadFeedbacks();
    } catch {
      toastError('Error', 'Failed to forward feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscard = async (id: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    try {
      await api.delete(`/feedback/${id}`);
      success('Deleted', 'Feedback deleted.');
      if (activeTab === 'student') loadFeedbacks();
      else loadRepliedFeedbacks();
    } catch {
      toastError('Error', 'Failed to delete feedback.');
    }
  };

  return (
    <Shell title="Activity" subtitle="Review and manage feedback" onLogout={onLogout}>
      <ActivityTabs />
      <div style={{ margin: '20px auto 0' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '4px', background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', width: 'fit-content' }}>
          <button 
            className={`btn ${activeTab === 'student' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-md)', padding: '6px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('student')}
          >
            Student Feedback
          </button>
          <button 
            className={`btn ${activeTab === 'staff' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-md)', padding: '6px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('staff')}
          >
            Staff Feedback
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading...</div>
        ) : activeTab === 'student' ? (
          feedbacks.length === 0 ? (
            <div className="card card-padded" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
              No pending feedback.
            </div>
          ) : (
            <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Enrollment Number</th>
                  <th style={{ textAlign: 'center' }}>Feedback</th>
                  <th>Forward</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.student_name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
                        {f.student_department && `${f.student_department} · Batch ${f.student_batch}`}
                        {!f.student_department && new Date(f.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>{f.student_enrollment_number || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.85rem' }} onClick={() => handleView(f)}>
                        View
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select 
                          className="input" 
                          style={{ minWidth: 150, padding: '4px 8px', height: 32 }}
                          value={rowSelections[f.id] || ''} 
                          onChange={(e) => handleRowSelection(f.id, e.target.value)}
                        >
                          <option value="">Select teacher...</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>{s.name} ({s.department || 'Staff'})</option>
                          ))}
                        </select>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '4px 12px', fontSize: '0.85rem', height: 32 }} 
                          onClick={() => handleForwardInline(f)}
                          disabled={submitting || !rowSelections[f.id]}
                        >
                          Forward
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '0.85rem', height: 32 }} onClick={() => handleDiscard(f.id)}>
                        Discard
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        ) : (
          repliedFeedbacks.length === 0 ? (
            <div className="card card-padded" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
              No staff feedback found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              {repliedFeedbacks.map(f => (
                <div key={f.id} className="card card-padded">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img 
                        src={f.staff_photo ? (proxiedImage(f.staff_photo) ?? undefined) : `https://ui-avatars.com/api/?name=${encodeURIComponent(f.staff_name || 'S')}&background=random`} 
                        alt="Staff" 
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} 
                        onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(f.staff_name || 'S')}&background=random`; }}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{f.staff_name || 'Staff Member'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                          {f.staff_department || 'Department'} · Replied on {new Date(f.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem', height: 28 }} onClick={() => handleView(f)}>
                        View Conversation
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '0.8rem', height: 28 }} onClick={() => handleDiscard(f.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 8, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                    {f.staff_reply}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: '24px', position: 'relative', maxHeight: 'calc(100dvh - 60px)', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginBottom: 20, fontSize: '1.25rem' }}>Feedback Conversation</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto', paddingRight: 8 }}>
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>Loading messages...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>No messages found.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{ alignSelf: m.sender_type === 'superadmin' ? 'flex-end' : (m.sender_type === 'staff' ? 'center' : 'flex-start'), maxWidth: '85%' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 4, [m.sender_type === 'superadmin' ? 'marginRight' : 'marginLeft']: 4, textAlign: m.sender_type === 'superadmin' ? 'right' : (m.sender_type === 'staff' ? 'center' : 'left') }}>
                      {m.sender_type === 'superadmin' ? 'You (Admin)' : (m.sender_type === 'staff' ? (viewModal.staff_name || 'Staff') : (viewModal.student_name || 'Student'))} • {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div style={{ padding: '12px 16px', background: m.sender_type === 'superadmin' ? 'var(--primary)' : (m.sender_type === 'staff' ? 'var(--surface-3)' : 'var(--surface-2)'), color: m.sender_type === 'superadmin' ? 'white' : 'var(--text)', borderRadius: m.sender_type === 'superadmin' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {m.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-2)' }}>Write a Reply:</div>
              <textarea 
                className="input" 
                rows={3} 
                placeholder="Type your reply here..." 
                value={replyText} 
                onChange={(e) => setReplyText(e.target.value)}
                style={{ resize: 'none', borderRadius: 12 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <button className="btn btn-outline" onClick={() => setViewModal(null)}>Close</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || loadingMessages}
                >
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ─── Teacher View ──────────────────────────────────────────────────
function TeacherFeedbackView({ onLogout }: { onLogout: () => void }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [viewModal, setViewModal] = useState<Feedback | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const { success, error: toastError } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Feedback[]>('/feedback/my');
      setFeedbacks(data);
    } catch {
      toastError('Error', 'Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} feedback(s)?`)) return;
    try {
      await Promise.all(selectedIds.map(id => api.delete(`/feedback/${id}`)));
      success('Deleted', 'Selected feedback deleted successfully.');
      setSelectedIds([]);
      load();
    } catch {
      toastError('Error', 'Failed to delete some feedback.');
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleView = async (f: Feedback) => {
    setViewModal(f);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const { data } = await api.get<FeedbackMessage[]>(`/feedback/${f.id}/messages`);
      setMessages(data);
    } catch {
      toastError('Error', 'Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    if (!viewModal || !replyText.trim()) return;
    try {
      await api.post(`/feedback/${viewModal.id}/messages`, { message: replyText });
      success('Sent', 'Message sent successfully.');
      setReplyText('');
      handleView(viewModal);
      load();
    } catch {
      toastError('Error', 'Failed to send message.');
    }
  };

  return (
    <Shell title="Activity" subtitle="Review and reply to feedback" onLogout={onLogout}>
      <ActivityTabs />
      <div style={{ width: '100%', margin: '20px auto 0' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button 
            className="btn btn-danger" 
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0}
          >
            Delete Selected {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading...</div>
        ) : feedbacks.length === 0 ? (
          <div className="card card-padded" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
            No feedback found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === feedbacks.length && feedbacks.length > 0}
                      onChange={(e) => setSelectedIds(e.target.checked ? feedbacks.map(f => f.id) : [])}
                      style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                  </th>
                  <th style={{ width: 150 }}>Date & Time</th>
                  <th>Feedback Snippet</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((f) => (
                  <tr key={f.id} onClick={() => handleView(f)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(f.id)}
                        onChange={() => toggleSelection(f.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
                      {new Date(f.created_at).toLocaleString()}
                    </td>
                    <td style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.content}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {f.staff_reply ? (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', borderRadius: 12, fontWeight: 600 }}>Replied</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--surface-3)', color: 'var(--text-2)', borderRadius: 12 }}>Pending</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '4px 12px', fontSize: '0.8rem', height: 28 }}
                        onClick={() => handleView(f)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: '24px', position: 'relative', maxHeight: 'calc(100dvh - 60px)', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginBottom: 20, fontSize: '1.25rem' }}>Feedback Conversation</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto', paddingRight: 8 }}>
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>Loading messages...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>No messages found.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{ alignSelf: m.sender_type === 'staff' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 4, [m.sender_type === 'staff' ? 'marginRight' : 'marginLeft']: 4, textAlign: m.sender_type === 'staff' ? 'right' : 'left' }}>
                      {m.sender_type === 'staff' ? 'You' : (m.sender_type === 'student' ? 'Student' : 'Admin')} • {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div style={{ padding: '12px 16px', background: m.sender_type === 'staff' ? 'var(--primary)' : 'var(--surface-2)', color: m.sender_type === 'staff' ? 'white' : 'var(--text)', borderRadius: m.sender_type === 'staff' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {m.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-2)' }}>Write a Reply:</div>
              <textarea 
                className="input" 
                rows={3} 
                placeholder="Type your reply here..." 
                value={replyText} 
                onChange={(e) => setReplyText(e.target.value)}
                style={{ resize: 'none', borderRadius: 12 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <button className="btn btn-outline" onClick={() => setViewModal(null)}>Close</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || loadingMessages}
                >
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
