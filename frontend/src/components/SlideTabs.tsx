import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../state/auth';

export function SlideTabs() {
  const location = useLocation();
  const { role } = useAuth();

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '12px 0' }}>
      {role === 'superadmin' && (
        <NavLink
          to="/exams/cards"
          style={({ isActive }) => ({
            padding: '8px 16px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: isActive || location.pathname === '/exams' ? 'var(--primary)' : 'transparent',
            color: isActive || location.pathname === '/exams' ? '#fff' : 'var(--text-2)',
            transition: 'all 0.2s ease',
          })}
        >
          Exam Cards
        </NavLink>
      )}
      
      <NavLink
        to="/exams/report"
        style={({ isActive }) => ({
          padding: '8px 16px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem',
          backgroundColor: isActive ? 'var(--primary)' : 'transparent',
          color: isActive ? '#fff' : 'var(--text-2)',
          transition: 'all 0.2s ease',
        })}
      >
        Exam Report
      </NavLink>
    </div>
  );
}
