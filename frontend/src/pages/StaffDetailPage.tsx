import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { proxiedImage } from '../lib/img';
import { useToast } from '../components/Toast';

export function StaffDetailPage({ onLogout }: { onLogout: () => void }) {
  const { id } = useParams<{ id: string }>();
  const { error } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await api.get(`/staff/${id}`);
        setProfile(res.data);
      } catch (err: any) {
        error('Error', err.response?.data?.message || 'Failed to fetch staff details');
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [id, error]);

  return (
    <Shell
      title="Staff Details"
      subtitle="View full staff information"
      onLogout={onLogout}
    >
      <div style={{ marginBottom: 20 }}>
        <Link to="/staff" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          &larr; Back to Directory
        </Link>
      </div>

      <div className="card card-padded" style={{ maxWidth: 800, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading details...</div>
        ) : !profile ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
            Staff member not found.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, width: 140, height: 140, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '4px solid var(--bg)' }}>
              {profile.photo_url ? (
                <img src={proxiedImage(profile.photo_url) ?? undefined} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '3rem', color: 'var(--text-3)', fontWeight: 800 }}>
                  {profile.name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{profile.name}</h2>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-2)', marginBottom: 20 }}>{profile.department || 'Staff'}</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 24px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Employee ID</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{profile.emp_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Date of Birth</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
                    {profile.dob ? new Date(profile.dob).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Phone Number</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{profile.phone || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Email Address</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
                    {profile.email ? (
                      <a href={`mailto:${profile.email}`} style={{ color: 'var(--blue)', textDecoration: 'none' }}>{profile.email}</a>
                    ) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
