import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardData } from '../services/reportService';
import Loading from '../components/common/Loading';
import StatsCard from '../components/dashboard/StatsCard';
import RecentProjects from '../components/dashboard/RecentProjects';
import MyTasks from '../components/dashboard/MyTasks';
import { FiFolder, FiCheckSquare, FiUsers, FiAlertTriangle, FiClock, FiDollarSign } from 'react-icons/fi';
import './DashboardPage.scss';

const DashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getDashboardData();
        setData(response);
      } catch (error) {
        toast.error("No se pudieron cargar los datos del dashboard.");
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

  if (loading) {
    return <Loading />;
  }

  const AdminDashboard = () => (
    <>
      <div className="stats-grid">
        <StatsCard title="Proyectos Totales" value={data.total_projects} icon={<FiFolder />} color="orange" />
        <StatsCard title="Usuarios Activos" value={data.active_users} icon={<FiUsers />} color="blue" />
        <StatsCard title="Tareas este Mes" value={data.completed_tasks_this_month} icon={<FiCheckSquare />} color="green" />
        <StatsCard title="Proyectos en Progreso" value={data.projects_in_progress} icon={<FiClock />} color="purple" />
      </div>
      <div className="dashboard-widgets-container">
        <RecentProjects projects={data.recent_projects} />
      </div>
    </>
  );

  const ManagerDashboard = () => (
    <>
      <div className="stats-grid">
        <StatsCard title="Mis Proyectos" value={data.my_projects_count} icon={<FiFolder />} color="orange" />
        <StatsCard title="Miembros del Equipo" value={data.team_members_count} icon={<FiUsers />} color="blue" />
        <StatsCard title="Tareas Pendientes (Equipo)" value={data.team_pending_tasks} icon={<FiAlertTriangle />} color="red" />
        <StatsCard title="Tareas Completadas (Equipo)" value={data.team_completed_tasks} icon={<FiCheckSquare />} color="green" />
      </div>
      <div className="dashboard-widgets-container">
        <RecentProjects projects={data.recent_projects} />
        <MyTasks tasks={data.my_pending_tasks} />
      </div>
    </>
  );

  const StudentDashboard = () => (
    <>
      <div className="stats-grid">
        <StatsCard title="Tareas Asignadas" value={data.assigned_tasks} icon={<FiCheckSquare />} color="blue" />
        <StatsCard title="Tareas Pendientes" value={data.pending_tasks} icon={<FiFolder />} color="orange" />
        <StatsCard title="Tareas Completadas" value={data.completed_tasks} icon={<FiCheckSquare />} color="green" />
        <StatsCard title="Tareas Vencidas" value={data.overdue_tasks} icon={<FiAlertTriangle />} color="red" />
      </div>
      <div className="dashboard-widgets-container">
        <MyTasks tasks={data.my_pending_tasks} />
      </div>
    </>
  );
  
  const ClientDashboard = () => (
    <>
      <div className="stats-grid">
          <StatsCard title="Proyectos Activos" value={data.active_projects_count} icon={<FiFolder />} color="orange" />
      </div>
      <div className="dashboard-widgets-container">
        <RecentProjects projects={data.projects} />
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
        {data ? getDashboardByRole() : <p>No hay datos para mostrar.</p>}
      </div>
    </>
  );
};

export default DashboardPage;