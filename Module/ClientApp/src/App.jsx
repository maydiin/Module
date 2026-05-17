import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import { AuthProvider } from './components/AuthContext';
import ModulesPage from './pages/ModulesPage';
import ModuleFieldsPage from './pages/ModuleFieldsPage';
import ModuleRecordsPage from './pages/ModuleRecordsPage';
import RecordDetailPage from './pages/RecordDetailPage';
import ModuleApiConfigsPage from './pages/ModuleApiConfigsPage';
import ModuleScriptsPage from './pages/ModuleScriptsPage';
import ModuleReportsPage from './pages/ModuleReportsPage';
import ModuleVisibilityRulesPage from './pages/ModuleVisibilityRulesPage';
import ModuleLayoutPage from './pages/ModuleLayoutPage';
import ReportViewerPage from './pages/ReportViewerPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ProtectedRoute from './components/ProtectedRoute';
import { TenantProvider } from './components/TenantContext';
import { ThemeProvider } from './components/ThemeContext';
import { ToastProvider } from './components/ToastContext';
import { NotificationProvider } from './components/NotificationContext';
import SettingsPage from './pages/SettingsPage';
import DashboardPage from './pages/DashboardPage';
import NotificationsPage from './pages/NotificationsPage';

function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <ThemeProvider>
          <ToastProvider>
            <NotificationProvider>
              <Router>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify-email" element={<EmailVerificationPage />} />
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Routes>
                            <Route path="/" element={<DashboardPage />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/modules" element={<ModulesPage />} />
                            <Route path="/modules/:moduleId/fields" element={<ModuleFieldsPage />} />
                            <Route path="/modules/:moduleId/records" element={<ModuleRecordsPage />} />
                            <Route path="/modules/:moduleId/records/:recordId" element={<RecordDetailPage />} />
                            <Route path="/modules/:moduleId/api-configs" element={<ModuleApiConfigsPage />} />
                            <Route path="/modules/:moduleId/scripts" element={<ModuleScriptsPage />} />
                            <Route path="/modules/:moduleId/visibility-rules" element={<ModuleVisibilityRulesPage />} />
                            <Route path="/modules/:moduleId/layout" element={<ModuleLayoutPage />} />
                            <Route path="/modules/:moduleId/reports" element={<ModuleReportsPage />} />
                            <Route path="/modules/:moduleId/reports/:reportId/view" element={<ReportViewerPage />} />
                            <Route path="/users" element={<UsersPage />} />
                            <Route path="/roles" element={<RolesPage />} />
                            <Route path="/audit-logs" element={<AuditLogsPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Router>
            </NotificationProvider>
          </ToastProvider>
        </ThemeProvider>
      </TenantProvider>
    </AuthProvider>
  );
}

export default App;
