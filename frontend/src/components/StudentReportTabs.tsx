import { NavLink, useLocation } from 'react-router-dom';

export function StudentReportTabs() {
  const location = useLocation();

  const getStyle = (isActive: boolean, path: string) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9rem',
    backgroundColor: isActive || (path === '/student-reports/late-comers' && location.pathname === '/student-reports') ? 'var(--primary)' : 'transparent',
    color: isActive || (path === '/student-reports/late-comers' && location.pathname === '/student-reports') ? '#fff' : 'var(--text-2)',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '12px 0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <NavLink to="/student-reports/late-comers" style={({ isActive }) => getStyle(isActive, '/student-reports/late-comers')}>
        Late Comers
      </NavLink>
      
      <NavLink to="/student-reports/disciplinary" style={({ isActive }) => getStyle(isActive, '/student-reports/disciplinary')}>
        Disciplinary
      </NavLink>

      <NavLink to="/student-reports/achievements" style={({ isActive }) => getStyle(isActive, '/student-reports/achievements')}>
        Achievements
      </NavLink>

      <NavLink to="/student-reports/placements" style={({ isActive }) => getStyle(isActive, '/student-reports/placements')}>
        Placements
      </NavLink>
    </div>
  );
}
