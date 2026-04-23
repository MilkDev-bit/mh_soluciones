import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ROLE_GROUPS } from './constants/roles';

import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/common/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const TwoFactorPage = lazy(() => import('./pages/auth/TwoFactorPage'));
const GoogleCallbackPage = lazy(() => import('./pages/auth/GoogleCallbackPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AccesosPage = lazy(() => import('./pages/admin/AccesosPage'));
const HRPage = lazy(() => import('./pages/hr/HRPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ActividadPage = lazy(() => import('./pages/ActividadPage'));
const ArchivosPage = lazy(() => import('./pages/ArchivosPage'));
const ReportesPage = lazy(() => import('./pages/ReportesPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));

const AppRoutes = () => {
  console.log("AppRoutes -> Renderizando el mapa de rutas.");

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-2fa" element={<TwoFactorPage />} />
      </Route>

      {/* Google OAuth Callback - Public route */}
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/actividad" element={<ActividadPage />} />
          <Route path="/archivos" element={<ArchivosPage />} />
          
          <Route path="/reportes" element={
            <ProtectedRoute roles={ROLE_GROUPS.ANALYTICS_VIEWERS}>
              <ReportesPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/users" element={
            <ProtectedRoute roles={ROLE_GROUPS.USER_MANAGERS}>
              <UsersPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/accesos" element={
            <ProtectedRoute roles={['SUPERADMIN']}>
              <AccesosPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/audit-log" element={
            <ProtectedRoute roles={['SUPERADMIN']}>
              <AuditLogPage />
            </ProtectedRoute>
          } />

          <Route path="/hr" element={
            <ProtectedRoute roles={['RH', 'SUPERADMIN']}>
              <HRPage />
            </ProtectedRoute>
          } />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;