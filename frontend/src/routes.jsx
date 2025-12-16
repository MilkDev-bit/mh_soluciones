import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ROLE_GROUPS } from './constants/roles';

import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/common/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const TwoFactorPage = lazy(() => import('./pages/auth/TwoFactorPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const HRPage = lazy(() => import('./pages/hr/HRPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ActividadPage = lazy(() => import('./pages/ActividadPage'));
const ArchivosPage = lazy(() => import('./pages/ArchivosPage'));
const ReportesPage = lazy(() => import('./pages/ReportesPage'));

const AppRoutes = () => {
  console.log("AppRoutes -> Renderizando el mapa de rutas.");

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-2fa" element={<TwoFactorPage />} />
      </Route>

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