import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { setAuthToken } from './api';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './state/auth';
import { ThemeProvider } from './state/theme';
import { canAccess } from './lib/roles';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { StudentCreatePage } from './pages/StudentCreatePage';
import { StudentEditPage } from './pages/StudentEditPage';
import { SettingsPage } from './pages/SettingsPage';
import { ImportPage } from './pages/ImportPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { LateComersPage } from './pages/LateComersPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { UsersPage } from './pages/UsersPage';

// Lazy-loaded: the scanner pulls in the heavy ZXing library, so only load it
// when the scanner route is actually opened.
const ScannerPage = lazy(() => import('./pages/ScannerPage').then((m) => ({ default: m.ScannerPage })));

/** Gate a route on authentication and (optionally) role. `roleKey` is the path
 *  used to look up allowed roles; unlisted keys allow any authenticated user. */
function Protected({ roleKey, children }: { roleKey: string; children: ReactNode }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!canAccess(roleKey, role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, logout, token } = useAuth();

  // Ensure axios always has the latest token on every render
  setAuthToken(token);

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route path="/dashboard" element={<Protected roleKey="/dashboard"><DashboardPage onLogout={logout} /></Protected>} />
      <Route path="/students" element={<Protected roleKey="/students"><StudentsPage onLogout={logout} /></Protected>} />
      <Route path="/students/new" element={<Protected roleKey="/students/new"><StudentCreatePage onLogout={logout} /></Protected>} />
      <Route path="/students/:id/edit" element={<Protected roleKey="/students/:id/edit"><StudentEditPage onLogout={logout} /></Protected>} />
      <Route path="/students/:id" element={<Protected roleKey="/students/:id"><StudentDetailPage onLogout={logout} /></Protected>} />
      <Route path="/import" element={<Protected roleKey="/import"><ImportPage onLogout={logout} /></Protected>} />
      <Route
        path="/scanner"
        element={
          <Protected roleKey="/scanner">
            <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading scanner…</div>}>
              <ScannerPage onLogout={logout} />
            </Suspense>
          </Protected>
        }
      />
      <Route path="/late-comers" element={<Protected roleKey="/late-comers"><LateComersPage onLogout={logout} /></Protected>} />
      <Route path="/achievements" element={<Protected roleKey="/achievements"><AchievementsPage onLogout={logout} /></Protected>} />
      <Route path="/users" element={<Protected roleKey="/users"><UsersPage onLogout={logout} /></Protected>} />
      <Route path="/audit" element={<Protected roleKey="/audit"><AuditLogPage onLogout={logout} /></Protected>} />
      <Route path="/settings" element={<Protected roleKey="/settings"><SettingsPage onLogout={logout} /></Protected>} />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
