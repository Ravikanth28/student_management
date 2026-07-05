import { useState, type CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useTheme } from '../state/theme';
import type { Role } from '../types';

function roleLabel(r: Role): string {
  return r === 'superadmin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'User';
}
const ROLE_COLORS: Record<Role, { bg: string; fg: string; dot: string }> = {
  superadmin: { bg: 'rgba(129,140,248,0.16)', fg: '#c7d2fe', dot: '#818cf8' },
  admin:      { bg: 'rgba(96,165,250,0.16)',  fg: '#bfdbfe', dot: '#60a5fa' },
  user:       { bg: 'rgba(255,255,255,0.10)', fg: 'rgba(255,255,255,0.78)', dot: 'rgba(255,255,255,0.6)' },
};
function rolePill(r: Role): CSSProperties {
  const c = ROLE_COLORS[r];
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content',
    fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.01em',
    padding: '3px 9px', borderRadius: 100, background: c.bg, color: c.fg,
  };
}

// ─── SVG Icons ──────────────────────────────────────────────
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconUploadNav() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function IconFilterNav() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconScan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" /><rect x="4" y="4" width="16" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconDroplet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.7l5.3 5.3a7.5 7.5 0 1 1-10.6 0z" />
    </svg>
  );
}

function IconUsersCog() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ─── Nav Items ───────────────────────────────────────────────
const NAV_ITEMS: Array<{ to: string; label: string; Icon: () => JSX.Element; roles: Role[] }> = [
  { to: '/dashboard',    label: 'Dashboard',        Icon: IconGrid,      roles: ['superadmin', 'admin', 'user'] },
  { to: '/students',     label: 'Student Records',  Icon: IconUsers,     roles: ['superadmin', 'admin', 'user'] },
  { to: '/blood-groups', label: 'Blood Groups',     Icon: IconDroplet,   roles: ['superadmin', 'admin', 'user'] },
  { to: '/students/new', label: 'Add Student',      Icon: IconPlus,      roles: ['superadmin', 'admin'] },
  { to: '/scanner',      label: 'Scanner',          Icon: IconScan,      roles: ['superadmin', 'admin'] },
  { to: '/attendance',   label: 'Attendance',       Icon: IconClipboard, roles: ['superadmin', 'admin'] },
  { to: '/late-comers',  label: 'Late Comers',      Icon: IconClock,     roles: ['superadmin', 'admin'] },
  { to: '/achievements', label: 'Achievements',     Icon: IconTrophy,    roles: ['superadmin', 'admin'] },
  { to: '/placements',   label: 'Placements',       Icon: IconBriefcase, roles: ['superadmin', 'admin'] },
  { to: '/import',       label: 'Bulk Import',      Icon: IconUploadNav, roles: ['superadmin', 'admin'] },
  { to: '/users',        label: 'Users',            Icon: IconUsersCog,  roles: ['superadmin'] },
  { to: '/audit',        label: 'Audit Log',        Icon: IconActivity,  roles: ['superadmin'] },
  { to: '/settings',     label: 'Settings',         Icon: IconSettings,  roles: ['superadmin'] },
];


// ─── Sidebar Content ─────────────────────────────────────────
function SidebarContent({ onLogout, onClose }: { onLogout: () => void; onClose?: () => void }) {
  const { role, displayName } = useAuth();
  const { theme, toggle } = useTheme();
  const items = NAV_ITEMS.filter((i) => role && i.roles.includes(role));

  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <IconShield />
          </div>
          <div className="brand-text">
            <strong>Student Portal</strong>
            <span>College Administration</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <span className="sidebar-section-label">Main Menu</span>
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {displayName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #4f7cc7, #2a4f7c)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', flexShrink: 0 }}>
              {displayName.charAt(0)}
            </div>
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>{displayName}</div>
              {role && (
                <span style={rolePill(role)}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLORS[role].dot }} />
                  {roleLabel(role)}
                </span>
              )}
            </div>
            <button
              className="theme-icon-btn"
              type="button"
              onClick={toggle}
              aria-label="Toggle light/dark theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        )}
        <button className="logout-btn" type="button" onClick={onLogout} id="logout-button">
          <IconLogout />
          Sign Out
        </button>
      </div>
    </>
  );
}

// ─── Shell Component ─────────────────────────────────────────
type ShellProps = {
  title: string;
  subtitle?: string;
  onLogout: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function Shell({ title, subtitle, onLogout, actions, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();

  // Close mobile menu on route change
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <SidebarContent onLogout={onLogout} onClose={closeMobile} />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay open"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Main */}
      <div className="main-content">
        {/* Mobile Top Bar */}
        <header className="top-bar">
          <button
            className="hamburger"
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Student Portal</span>
          <button className="hamburger" type="button" aria-label="Toggle light/dark theme" onClick={toggle}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </header>

        {/* Page Header */}
        <div className="content-header">
          <div className="page-meta">
            <span className="page-eyebrow">Administration</span>
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginTop: 4 }}>{subtitle}</p> : null}
          </div>
          {actions ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, flexWrap: 'wrap' }}>
              {actions}
            </div>
          ) : null}
        </div>

        {/* Page Body */}
        <main className="content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
