import { useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { useAuth } from '../state/auth';
import { proxiedImage } from '../lib/img';

export function StaffProfilePage({ onLogout }: { onLogout: () => void }) {
  const { staffProfile } = useAuth();
  const profile = staffProfile;

  return (
    <Shell
      title={profile?.name?.toUpperCase() ?? "My Profile"}
      subtitle={profile ? `${profile.department || 'Staff'} · Active` : "Your Staff Profile Information"}
      onLogout={onLogout}
    >
      <div className="card card-padded">
        {!profile ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
            No staff profile linked to this account.
          </div>
        ) : (
          <>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              <span className="badge badge-blue" style={{ padding: '4px 14px' }}>{profile.department || 'Staff'}</span>
              <span className="badge badge-green" style={{ padding: '4px 14px' }}>Active</span>
            </div>

            <div className="profile-layout">
              {/* Photo Panel */}
              <div>
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    border: '2px solid var(--border)',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-3)',
                    position: 'relative',
                  }}
                >
                  {profile.photo_url ? (
                    <img src={proxiedImage(profile.photo_url) ?? undefined} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <span style={{ fontSize: '4rem', color: 'var(--text-3)', fontWeight: 800 }}>
                      {profile.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div className="card" style={{ marginTop: 12, padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Employee ID</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.02em' }}>{profile.emp_id}</div>
                </div>
              </div>
              
              {/* Info Grid */}
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 20, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                  {profile.name}
                </h2>
                
                <div className="profile-info-grid">
                  <div className="profile-field">
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      EMPLOYEE ID
                    </span>
                    <span className={`field-value${!profile.emp_id ? ' empty' : ''}`}>
                      {profile.emp_id || 'Not provided'}
                    </span>
                  </div>

                  <div className="profile-field">
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      DEPARTMENT
                    </span>
                    <span className={`field-value${!profile.department ? ' empty' : ''}`}>
                      {profile.department || 'Not provided'}
                    </span>
                  </div>

                  <div className="profile-field">
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      DATE OF BIRTH
                    </span>
                    <span className={`field-value${!profile.dob ? ' empty' : ''}`}>
                      {profile.dob ? new Date(profile.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not provided'}
                    </span>
                  </div>
                  
                  <div className="profile-field">
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      PHONE NUMBER
                    </span>
                    <span className={`field-value${!profile.phone ? ' empty' : ''}`}>
                      {profile.phone || 'Not provided'}
                    </span>
                  </div>

                  <div className="profile-field" style={{ gridColumn: '1 / -1' }}>
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      EMAIL ADDRESS
                    </span>
                    <span className={`field-value${!profile.email ? ' empty' : ''}`}>
                      {profile.email ? (
                        <a href={`mailto:${profile.email}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>{profile.email}</a>
                      ) : 'Not provided'}
                    </span>
                  </div>
                </div>
                
                {/* Timestamps */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 24, fontSize: '0.75rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                  <span>Added: <strong>{profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</strong></span>
                  <span>Updated: <strong>{profile.updated_at ? new Date(profile.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</strong></span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
