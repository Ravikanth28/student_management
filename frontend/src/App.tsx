import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { setAuthToken } from './api';
import { ToastProvider } from './components/Toast';
import { NotificationsManager } from './components/NotificationsManager';
import { AuthProvider, useAuth } from './state/auth';
import { ThemeProvider } from './state/theme';
import { canAccess } from './lib/roles';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { BloodGroupsPage } from './pages/BloodGroupsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { StudentCreatePage } from './pages/StudentCreatePage';
import { StudentEditPage } from './pages/StudentEditPage';
import { SettingsPage } from './pages/SettingsPage';
import { ImportPage } from './pages/ImportPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { LateComersPage } from './pages/LateComersPage';
import { DisciplinaryPage } from './pages/DisciplinaryPage';
import { AttendancePage } from './pages/AttendancePage';
import { CircularsPage } from './pages/CircularsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { PlacementsPage } from './pages/PlacementsPage';
import { UsersPage } from './pages/UsersPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { ExamCardsPage } from './pages/ExamCardsPage';
import { ExamReportPage } from './pages/ExamReportPage';
import { StudentMarksPage } from './pages/StudentMarksPage';

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

function ActivityRedirect() {
  const { role } = useAuth();
  if (role === 'student') return <Navigate to="/activity/feedback" replace />;
  return <Navigate to="/activity/circulars" replace />;
}

function AppRoutes() {
  const { isAuthenticated, logout, token, role } = useAuth();

  // Ensure axios always has the latest token on every render
  setAuthToken(token);

  const defaultHome = '/dashboard';

  return (
    <>
      <NotificationsManager />
      <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={defaultHome} replace /> : <LoginPage />} />

      <Route path="/dashboard" element={<Protected roleKey="/dashboard"><DashboardPage onLogout={logout} /></Protected>} />
      <Route path="/students" element={<Protected roleKey="/students"><StudentsPage onLogout={logout} /></Protected>} />
      <Route path="/blood-groups" element={<Protected roleKey="/blood-groups"><BloodGroupsPage onLogout={logout} /></Protected>} />
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
      <Route path="/attendance" element={<Protected roleKey="/attendance"><AttendancePage onLogout={logout} /></Protected>} />
      <Route path="/activity" element={<ActivityRedirect />} />
      <Route path="/activity/circulars" element={<Protected roleKey="/circulars"><CircularsPage onLogout={logout} /></Protected>} />
      <Route path="/student-reports" element={<Navigate to="/student-reports/late-comers" replace />} />
      <Route path="/student-reports/late-comers" element={<Protected roleKey="/student-reports"><LateComersPage onLogout={logout} /></Protected>} />
      <Route path="/student-reports/disciplinary" element={<Protected roleKey="/student-reports"><DisciplinaryPage onLogout={logout} /></Protected>} />
      <Route path="/student-reports/achievements" element={<Protected roleKey="/student-reports"><AchievementsPage onLogout={logout} /></Protected>} />
      <Route path="/student-reports/placements" element={<Protected roleKey="/student-reports"><PlacementsPage onLogout={logout} /></Protected>} />
      <Route path="/users" element={<Protected roleKey="/users"><UsersPage onLogout={logout} /></Protected>} />
      <Route path="/audit" element={<Protected roleKey="/audit"><AuditLogPage onLogout={logout} /></Protected>} />
      <Route path="/settings" element={<Protected roleKey="/settings"><SettingsPage onLogout={logout} /></Protected>} />
      <Route path="/activity/feedback" element={<Protected roleKey="/feedback"><FeedbackPage onLogout={logout} /></Protected>} />
      <Route path="/exams" element={<Navigate to="/exams/cards" replace />} />
      <Route path="/exams/cards" element={<Protected roleKey="/exams"><ExamCardsPage onLogout={logout} /></Protected>} />
      <Route path="/exams/report" element={<Protected roleKey="/exams"><ExamReportPage onLogout={logout} /></Protected>} />
      <Route path="/my-exam-marks" element={<Protected roleKey="/my-exam-marks"><StudentMarksPage onLogout={logout} /></Protected>} />

      <Route path="*" element={<Navigate to={isAuthenticated ? defaultHome : '/login'} replace />} />
      </Routes>
    </>
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
