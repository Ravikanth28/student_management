import { Navigate, Route, Routes } from 'react-router-dom';
import { setAuthToken } from './api';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './state/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { StudentCreatePage } from './pages/StudentCreatePage';
import { StudentEditPage } from './pages/StudentEditPage';
import { SettingsPage } from './pages/SettingsPage';
import { ImportPage } from './pages/ImportPage';
import { AuditLogPage } from './pages/AuditLogPage';

function AppRoutes() {
  const { isAuthenticated, logout, token } = useAuth();

  // Ensure axios always has the latest token on every render
  setAuthToken(token);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={isAuthenticated ? <DashboardPage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/students"
        element={isAuthenticated ? <StudentsPage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/students/new"
        element={isAuthenticated ? <StudentCreatePage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/students/:id/edit"
        element={isAuthenticated ? <StudentEditPage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/students/:id"
        element={isAuthenticated ? <StudentDetailPage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/import"
        element={isAuthenticated ? <ImportPage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/audit"
        element={isAuthenticated ? <AuditLogPage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/settings"
        element={isAuthenticated ? <SettingsPage onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
