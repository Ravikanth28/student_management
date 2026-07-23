import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAuthToken } from '../api';
import { useAuth } from '../state/auth';
import { useToast } from '../components/Toast';
import { GetAppLink } from '../components/InstallApp';
import type { LoginResponse } from '../types';

// ─── SVG Icons ──────────────────────────────────────────────
function IconShield() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

const FEATURES = [
  'JWT-secured administrator access',
  'Complete student CRUD operations',
  'Live smart search with suggestions',
  'TiDB cloud database integration',
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { error: toastError } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  // Client-side validation
  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!username.trim()) errs.username = 'Username is required';
    if (!password)        errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await api.post<LoginResponse>('/auth/login', { username, password });
      login(response.data);
      setAuthToken(response.data.token);
      navigate('/dashboard', { replace: true });
    } catch {
      toastError('Login failed', 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        {/* Left Branding Panel */}
        <aside className="auth-panel-left" aria-hidden="true">
          <div className="auth-logo">
            <IconShield />
          </div>
          <div>
            <h2 className="auth-brand-title">Student Management<br />Portal</h2>
            <p className="auth-brand-sub">Secure college administration<br />system for managing student records.</p>
          </div>
          <ul className="auth-features" role="list">
            {FEATURES.map(f => (
              <li key={f} className="auth-feature">
                <IconCheck />
                {f}
              </li>
            ))}
          </ul>
        </aside>

        {/* Right Login Panel */}
        <section className="auth-panel-right">
          <div className="auth-card">
            {/* Card logo (mobile) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--blue-light)', display: 'grid', placeItems: 'center', color: 'var(--blue)'
              }}>
                <IconShield />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>Student Portal</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>College Administration</div>
              </div>
            </div>

            <h1 className="auth-title">Admin Sign In</h1>
            <p className="auth-sub">Enter your credentials to access the portal.</p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {/* Username */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-username">
                  <IconUser /> Username <span className="required">*</span>
                </label>
                <input
                  id="login-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  className={`form-control${fieldErrors.username ? ' error' : ''}`}
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setFieldErrors(prev => ({ ...prev, username: undefined })); }}
                />
                {fieldErrors.username ? <span className="form-error">{fieldErrors.username}</span> : null}
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  <IconLock /> Password <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    className={`form-control${fieldErrors.password ? ' error' : ''}`}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: undefined })); }}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {fieldErrors.password ? <span className="form-error">{fieldErrors.password}</span> : null}
              </div>

              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 4 }}
                disabled={loading}
              >
                {loading ? <Spinner /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 24, textAlign: 'center' }}>
              Access restricted to authorized administrators only.
            </p>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <GetAppLink />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
