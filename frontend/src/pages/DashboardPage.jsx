import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardData } from '../services/reportService';
import Loading from '../components/common/Loading';
import StatsCard from '../components/dashboard/StatsCard';
import RecentProjects from '../components/dashboard/RecentProjects';
import MyTasks from '../components/dashboard/MyTasks';
import { FiFolder, FiCheckSquare, FiUsers, FiAlertTriangle, FiClock } from 'react-icons/fi';
import './DashboardPage.scss';

const DashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching dashboard data from /api/v1/reports/dashboard/...');
        
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await getDashboardData();
        console.log('Dashboard data received:', response);
        setData(response);
      } catch (error) {
        console.error('Detailed error:', error);
        
        if (error.response?.status === 401) {
          setError('Error de autenticación. Por favor, inicia sesión nuevamente.');
          toast.error('Sesión expirada. Redirigiendo al login...');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else {
          const errorMessage = error.response?.data?.detail || error.message || "No se pudieron cargar los datos del dashboard.";
          setError(errorMessage);
          toast.error(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const renderWelcomeMessage = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${greeting}, ${user.first_name || user.username}!`;
  };

  const getDemoDataByRole = () => {
    const baseDemoData = {
      kpis: {
        total_projects: 12,
        active_users: 8,
        completed_tasks_this_month: 45,
        projects_in_progress: 4,
        my_projects_count: 3,
        team_members_count: 5,
        team_pending_tasks: 8,
        team_completed_tasks: 15,
        assigned_tasks: 7,
        pending_tasks: 3,
        completed_tasks: 4,
        overdue_tasks: 1,
        active_projects_count: 2,
        completed_projects_count: 1
      },
      recent_activity: {
        projects: [
          { id: 1, name: "Proyecto Demo", status: "IN_PROGRESS", status_display: "En Progreso", progress: 65 }
        ],
        tasks: []
      },
      projects_summary: [
        { id: 1, name: "Proyecto Demo", status: "IN_PROGRESS", status_display: "En Progreso", progress: 65 }
      ],
      upcoming_deadlines: [
        { id: 1, title: "Tarea Demo", project_name: "Proyecto Demo", due_date: "2024-01-15", status: "PENDING", status_display: "Pendiente" }
      ],
      my_pending_tasks: [
        { id: 1, title: "Mi Tarea Demo", project_name: "Proyecto Demo", due_date: "2024-01-15", status: "PENDING", status_display: "Pendiente" }
      ]
    };
    return baseDemoData;
  };

  if (loading) {
    return <Loading />;
  }

  const displayData = data || getDemoDataByRole();

  const AdminDashboard = () => (
    <>
      <div className="stats-grid">
        <StatsCard 
          title="Proyectos Totales" 
          value={displayData.kpis.total_projects} 
          icon={<FiFolder />} 
          color="orange" 
        />
        <StatsCard 
          title="Usuarios Activos" 
          value={displayData.kpis.active_users} 
          icon={<FiUsers />} 
          color="blue" 
        />
        <StatsCard 
          title="Tareas este Mes" 
          value={displayData.kpis.completed_tasks_this_month} 
          icon={<FiCheckSquare />} 
          color="green" 
        />
        <StatsCard 
          title="Proyectos en Progreso" 
          value={displayData.kpis.projects_in_progress} 
          icon={<FiClock />} 
          color="purple" 
        />
      </div>
      <div className="dashboard-widgets-container">
        <RecentProjects projects={displayData.recent_activity?.projects || displayData.projects_summary} />
      </div>
    </>
  );

  const ManagerDashboard = () => (
    <>
      <div className="stats-grid">
        <StatsCard 
          title="Mis Proyectos" 
          value={displayData.kpis.my_projects_count} 
          icon={<FiFolder />} 
          color="orange" 
        />
        <StatsCard 
          title="Miembros del Equipo" 
          value={displayData.kpis.team_members_count} 
          icon={<FiUsers />} 
          color="blue" 
        />
        <StatsCard 
          title="Tareas Pendientes (Equipo)" 
          value={displayData.kpis.team_pending_tasks} 
          icon={<FiAlertTriangle />} 
          color="red" 
        />
        <StatsCard 
          title="Tareas Completadas (Equipo)" 
          value={displayData.kpis.team_completed_tasks} 
          icon={<FiCheckSquare />} 
          color="green" 
        />
      </div>
      <div className="dashboard-widgets-container">
        <RecentProjects projects={displayData.projects_summary} />
        <MyTasks tasks={displayData.upcoming_deadlines} />
      </div>
    </>
  );

  const StudentDashboard = () => (
    <>
      <div className="stats-grid">
        <StatsCard 
          title="Tareas Asignadas" 
          value={displayData.kpis.assigned_tasks} 
          icon={<FiCheckSquare />} 
          color="blue" 
        />
        <StatsCard 
          title="Tareas Pendientes" 
          value={displayData.kpis.pending_tasks} 
          icon={<FiFolder />} 
          color="orange" 
        />
        <StatsCard 
          title="Tareas Completadas" 
          value={displayData.kpis.completed_tasks} 
          icon={<FiCheckSquare />} 
          color="green" 
        />
        <StatsCard 
          title="Tareas Vencidas" 
          value={displayData.kpis.overdue_tasks} 
          icon={<FiAlertTriangle />} 
          color="red" 
        />
      </div>
      <div className="dashboard-widgets-container">
        <MyTasks tasks={displayData.my_pending_tasks} />
      </div>
    </>
  );
  
  const ClientDashboard = () => (
    <>
      <div className="stats-grid">
        <StatsCard 
          title="Proyectos Activos" 
          value={displayData.kpis.active_projects_count} 
          icon={<FiFolder />} 
          color="orange" 
        />
        <StatsCard 
          title="Proyectos Completados" 
          value={displayData.kpis.completed_projects_count} 
          icon={<FiCheckSquare />} 
          color="green" 
        />
      </div>
      <div className="dashboard-widgets-container">
        <RecentProjects projects={displayData.projects_summary} />
      </div>
    </>
  );

  const getDashboardByRole = () => {
    switch (user.role) {
      case 'SUPERADMIN':
      case 'ADMIN':
      case 'CEO':
      case 'RH':
        return <AdminDashboard />;
      case 'DIRECTOR':
      case 'PROFESSOR':
        return <ManagerDashboard />;
      case 'STUDENT':
        return <StudentDashboard />;
      case 'CLIENT':
        return <ClientDashboard />;
      default:
        return <p>Bienvenido. Tu dashboard se está configurando.</p>;
    }
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | MH Soluciones</title>
      </Helmet>
      <div className="dashboard-page">
        <h1 className="welcome-message">{renderWelcomeMessage()}</h1>
        <p className="welcome-subtitle">Aquí tienes un resumen de tu actividad reciente.</p>
        
        {error && (
          <div className="error-banner">
            <p><strong>Error:</strong> {error}</p>
            {error.includes('autenticación') && (
              <p>Mostrando datos de demostración. Por favor, inicia sesión nuevamente.</p>
            )}
          </div>
        )}
        
        {getDashboardByRole()}
      </div>
    </>
  );
};

export default DashboardPage;