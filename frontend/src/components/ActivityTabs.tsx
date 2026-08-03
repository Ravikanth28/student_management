import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../state/auth';

export function ActivityTabs() {
  const location = useLocation();
  const { role } = useAuth();

  const getStyle = (isActive: boolean, path: string) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9rem',
    backgroundColor: isActive || (path === '/activity/circulars' && location.pathname === '/activity' && role !== 'student') || (path === '/activity/feedback' && location.pathname === '/activity' && role === 'student') ? 'var(--primary)' : 'transparent',
    color: isActive || (path === '/activity/circulars' && location.pathname === '/activity' && role !== 'student') || (path === '/activity/feedback' && location.pathname === '/activity' && role === 'student') ? '#fff' : 'var(--text-2)',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '12px 0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {(role === 'superadmin' || role === 'admin' || role === 'user') && (
        <NavLink to="/activity/circulars" style={({ isActive }) => getStyle(isActive, '/activity/circulars')}>
          Circulars
        </NavLink>
      )}
      
      {(role === 'superadmin' || role === 'student') && (
        <NavLink to="/activity/feedback" style={({ isActive }) => getStyle(isActive, '/activity/feedback')}>
          Feedback
        </NavLink>
      )}
    </div>
  );
}
