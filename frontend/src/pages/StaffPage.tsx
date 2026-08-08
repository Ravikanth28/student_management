import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { useAuth } from '../state/auth';
import { proxiedImage } from '../lib/img';

// --- SVG Icons ----------------------------------------------
function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconMoreVertical() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function StaffPage({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { success, error } = useToast();
  
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMenuOpen, setActionMenuOpen] = useState<number | null>(null);
  const [viewStaff, setViewStaff] = useState<any | null>(null);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff');
      setStaff(res.data);
    } catch (err: any) {
      error('Error', err.response?.data?.message || 'Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role !== 'superadmin' && role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchStaff();
  }, [role, navigate]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this staff record?')) return;
    try {
      await api.delete(`/staff/${id}`);
      success('Deleted', 'Staff record deleted');
      fetchStaff();
    } catch (err: any) {
      error('Error', err.response?.data?.message || 'Failed to delete staff');
    }
  };

  return (
    <Shell
      title="Staff Directory"
      subtitle="Manage all staff members"
      onLogout={onLogout}
    >
      <div className="card card-padded">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading staff...</div>
        ) : staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
            No staff records found. Use the Bulk Import page to add staff.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Photo</th>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                        {s.photo_url ? (
                          <img src={proxiedImage(s.photo_url) ?? undefined} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-3)', fontWeight: 700 }}>
                            {s.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.emp_id}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.department || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="td-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => setViewStaff(s)}
                          title="View Details"
                        >
                          <IconEye /> View
                        </button>
                        {role === 'superadmin' && (
                          <div className="actions-dropdown-container">
                            <button
                              className="btn btn-outline btn-sm"
                              type="button"
                              style={{ padding: '0 8px' }}
                              onClick={() => setActionMenuOpen(actionMenuOpen === s.id ? null : s.id)}
                            >
                              <IconMoreVertical />
                            </button>
                            {actionMenuOpen === s.id && (
                              <div className="actions-dropdown" style={{ right: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => { setActionMenuOpen(null); handleDelete(s.id); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)' }}
                                >
                                  <IconTrash /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewStaff && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'grid',
          placeItems: 'center',
          padding: 20
        }}>
          <div className="card card-padded" style={{ 
            width: '100%', 
            maxWidth: 600, 
            position: 'relative',
            animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setViewStaff(null)}
              style={{ position: 'absolute', top: 16, right: 16, padding: 6, border: 'none', background: 'transparent' }}
            >
              <IconClose />
            </button>
            
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 24, paddingRight: 40 }}>Staff Details</h3>
            
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0, width: 100, height: 100, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '3px solid var(--bg)' }}>
                {viewStaff.photo_url ? (
                  <img src={proxiedImage(viewStaff.photo_url) ?? undefined} alt={viewStaff.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '2.5rem', color: 'var(--text-3)', fontWeight: 800 }}>
                    {viewStaff.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: 200 }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{viewStaff.name}</h2>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-2)', marginBottom: 20 }}>{viewStaff.department || 'Staff'}</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Employee ID</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{viewStaff.emp_id}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Date of Birth</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
                      {viewStaff.dob ? new Date(viewStaff.dob).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Phone Number</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{viewStaff.phone || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Email Address</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
                      {viewStaff.email ? (
                        <a href={`mailto:${viewStaff.email}`} style={{ color: 'var(--blue)', textDecoration: 'none' }}>{viewStaff.email}</a>
                      ) : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setViewStaff(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
