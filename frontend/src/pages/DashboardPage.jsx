import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardData } from '../services/reportService';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import StatsCard from '../components/dashboard/StatsCard';
import RecentProjects from '../components/dashboard/RecentProjects';
import MyTasks from '../components/dashboard/MyTasks';
import DraggableDashboard from '../components/dashboard/DraggableDashboard';
import { FiFolder, FiCheckSquare, FiUsers, FiAlertTriangle, FiClock } from 'react-icons/fi';
import './DashboardPage.scss';

// Icon mapping for serializable config
const ICONS = {
  folder: <FiFolder />,
  users: <FiUsers />,
  check: <FiCheckSquare />,
  alert: <FiAlertTriangle />,
  clock: <FiClock />
};

const DashboardPage = () => {
  const { user } = useAuth();

  // Dashboard items state
  const [items, setItems] = useState([]);

  // Use React Query for data fetching
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['dashboard', user?.id, user?.role],
    queryFn: () => getDashboardData(),
    onError: (error) => {
      if (error.response?.status === 401) {
        toast.error('Sesión expirada.');
        setTimeout(() => window.location.href = '/login', 2000);
      } else {
        toast.error("Error cargando dashboard");
      }
    },
    staleTime: 60000, // 1 minute
    retry: 1,
    enabled: !!user,
  });

  const displayData = useMemo(() => {
    if (data) return data;
    // Fallback/Demo Data
    return {
      kpis: {
        total_projects: 12, active_users: 8, completed_tasks_this_month: 45, projects_in_progress: 4,
        my_projects_count: 3, team_members_count: 5, team_pending_tasks: 8, team_completed_tasks: 15,
        assigned_tasks: 7, pending_tasks: 3, completed_tasks: 4, overdue_tasks: 1,
        active_projects_count: 2, completed_projects_count: 1
      },
      recent_activity: { projects: [{ id: 1, name: "Proyecto Demo", status: "IN_PROGRESS", status_display: "En Progreso", progress: 65 }] },
      projects_summary: [{ id: 1, name: "Proyecto Demo", status: "IN_PROGRESS", status_display: "En Progreso", progress: 65 }],
      upcoming_deadlines: [{ id: 1, title: "Tarea Demo", project_name: "Proyecto Demo", due_date: "2024-01-15", status: "PENDING", status_display: "Pendiente" }],
      my_pending_tasks: [{ id: 1, title: "Mi Tarea Demo", project_name: "Proyecto Demo", due_date: "2024-01-15", status: "PENDING", status_display: "Pendiente" }]
    };
  }, [data]);

  // Define default definitions based on Role
  useEffect(() => {
    if (!user) return;

    const getDefaultItems = (role) => {
      const kpis = displayData.kpis;

      const commonWidgets = [];
      const statsWidgets = [];

      switch (role) {
        case 'SUPERADMIN':
        case 'ADMIN':
        case 'CEO':
        case 'RH':
          statsWidgets.push(
            { id: 'total-projects', type: 'stat', title: 'Proyectos Totales', value: kpis.total_projects, icon: 'folder', color: 'orange' },
            { id: 'active-users', type: 'stat', title: 'Usuarios Activos', value: kpis.active_users, icon: 'users', color: 'blue' },
            { id: 'tasks-month', type: 'stat', title: 'Tareas este Mes', value: kpis.completed_tasks_this_month, icon: 'check', color: 'green' },
            { id: 'projects-progress', type: 'stat', title: 'Proyectos en Progreso', value: kpis.projects_in_progress, icon: 'clock', color: 'purple' }
          );
          commonWidgets.push({ id: 'recent-projects', type: 'recent-projects', title: 'Proyectos Recientes' });
          break;

        case 'DIRECTOR':
        case 'PROFESSOR':
          statsWidgets.push(
            { id: 'my-projects', type: 'stat', title: 'Mis Proyectos', value: kpis.my_projects_count, icon: 'folder', color: 'orange' },
            { id: 'team-members', type: 'stat', title: 'Miembros Equipo', value: kpis.team_members_count, icon: 'users', color: 'blue' },
            { id: 'team-pending', type: 'stat', title: 'Pendientes (Equipo)', value: kpis.team_pending_tasks, icon: 'alert', color: 'red' },
            { id: 'team-completed', type: 'stat', title: 'Completadas (Equipo)', value: kpis.team_completed_tasks, icon: 'check', color: 'green' }
          );
          commonWidgets.push(
            { id: 'recent-projects', type: 'recent-projects' },
            { id: 'my-tasks', type: 'my-tasks' }
          );
          break;

        case 'STUDENT':
          statsWidgets.push(
            { id: 'assigned', type: 'stat', title: 'Asignadas', value: kpis.assigned_tasks, icon: 'check', color: 'blue' },
            { id: 'pending', type: 'stat', title: 'Pendientes', value: kpis.pending_tasks, icon: 'folder', color: 'orange' },
            { id: 'completed', type: 'stat', title: 'Completadas', value: kpis.completed_tasks, icon: 'check', color: 'green' },
            { id: 'overdue', type: 'stat', title: 'Vencidas', value: kpis.overdue_tasks, icon: 'alert', color: 'red' }
          );
          commonWidgets.push({ id: 'my-tasks', type: 'my-tasks' });
          break;

        case 'CLIENT':
          statsWidgets.push(
            { id: 'active-proj', type: 'stat', title: 'Proyectos Activos', value: kpis.active_projects_count, icon: 'folder', color: 'orange' },
            { id: 'completed-proj', type: 'stat', title: 'Proyectos Completados', value: kpis.completed_projects_count, icon: 'check', color: 'green' }
          );
          commonWidgets.push({ id: 'recent-projects', type: 'recent-projects' });
          break;

        default:
          break;
      }

      return [...statsWidgets, ...commonWidgets];
    };

    // Load from LocalStorage if available for this role
    const savedOrderKey = `dashboard_order_${user.role}`;
    const savedOrder = JSON.parse(localStorage.getItem(savedOrderKey));

    const defaults = getDefaultItems(user.role);

    // Clear saved order if widget count doesn't match (different role or stale data)
    const validSavedOrder = savedOrder && savedOrder.length === defaults.length ? savedOrder : null;
    if (savedOrder && !validSavedOrder) {
      localStorage.removeItem(savedOrderKey);
    }

    if (validSavedOrder) {
      // Merge saved order with current data values
      // This assumes IDs didn't change. simpler logic: use defaults but sort by savedOrder IDs
      const orderMap = new Map(validSavedOrder.map((id, index) => [id, index]));
      const sorted = [...defaults].sort((a, b) => {
        const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
        const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
        return indexA - indexB;
      });
      setItems(sorted);
    } else {
      setItems(defaults);
    }

  }, [user, displayData]);

  const handleOrderChange = (newItems) => {
    setItems(newItems);
    localStorage.setItem(`dashboard_order_${user.role}`, JSON.stringify(newItems.map(i => i.id)));
  };

  const renderWidget = (item) => {
    switch (item.type) {
      case 'stat':
        return (
          <StatsCard
            title={item.title}
            value={item.value}
            icon={ICONS[item.icon]}
            color={item.color}
          />
        );
      case 'recent-projects':
        return <RecentProjects projects={displayData.recent_activity?.projects || displayData.projects_summary} />;
      case 'my-tasks':
        return <MyTasks tasks={displayData.upcoming_deadlines || displayData.my_pending_tasks} />;
      default:
        return null;
    }
  };

  const renderWelcomeMessage = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${greeting}, ${user?.first_name || user?.username || 'Usuario'}!`;
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <>
      <Helmet>
        <title>Dashboard | MH Soluciones</title>
      </Helmet>
      <div className="dashboard-page">
        <h1 className="welcome-message">{renderWelcomeMessage()}</h1>
        <p className="welcome-subtitle">Bienvenido a tu panel de control personalizado. Arrastra los widgets para organizarlos.</p>

        {error && (
          <div className="error-banner">
            <p>{error}</p>
          </div>
        )}

        {items.length > 0 ? (
          <DraggableDashboard
            items={items}
            onOrderChange={handleOrderChange}
            renderItem={renderWidget}
          />
        ) : (
          <p>Configurando tu dashboard...</p>
        )}
      </div>
    </>
  );
};

export default DashboardPage;
