import React, { useState, useEffect, useContext } from 'react';
import { 
  FiCheckSquare, 
  FiFileText, 
  FiCalendar, 
  FiUsers, 
  FiMessageSquare,
  FiFolder,
  FiUpload,
  FiEdit,
  FiBell
} from 'react-icons/fi';
import { AuthContext } from '../contexts/AuthContext';
import { getNotifications } from '../services/NotificationService';
import toast from 'react-hot-toast';
import './ActividadPage.scss';

const ActividadPage = () => {
  const { user } = useContext(AuthContext);
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('TODAS');
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarActividades();
  }, [filtroTipo]);

  const cargarActividades = async () => {
    try {
      setCargando(true);
      setError(null);
      
      // Fetch real notifications from the API with all read/unread
      const notificaciones = await getNotifications({ include_read: true, limit: 100 });
      
      // Transform notifications to activity format
      const actividadesTransformadas = notificaciones.map(notif => ({
        id: notif.id,
        tipo: notif.notification_type,
        titulo: notif.title,
        descripcion: notif.message,
        fecha: new Date(notif.created_at),
        leida: notif.is_read,
        icono: getIconoParaTipo(notif.notification_type)
      }));
      
      // Filter by type if needed
      let actividadesFiltradas = actividadesTransformadas;
      if (filtroTipo !== 'TODAS') {
        actividadesFiltradas = actividadesTransformadas.filter(
          act => mapTipoAFiltro(act.tipo) === filtroTipo
        );
      }
      
      setActividades(actividadesFiltradas);
    } catch (error) {
      console.error('Error cargando actividades:', error);
      setError('No se pudieron cargar las actividades. Por favor, intenta de nuevo.');
      toast.error('Error al cargar actividades');
    } finally {
      setCargando(false);
    }
  };

  const getIconoParaTipo = (tipo) => {
    const mapeo = {
      'TASK_ASSIGNED': 'checkSquare',
      'TASK_DUE': 'checkSquare',
      'TASK_OVERDUE': 'checkSquare',
      'TASK_COMPLETED': 'checkSquare',
      'FILE_UPLOADED': 'upload',
      'COMMENT_REPLY': 'messageSquare',
      'CALENDAR_EVENT': 'calendar',
      'EVENT_REMINDER': 'calendar',
      'TEAM_INVITATION': 'users',
      'PROJECT_UPDATE': 'folder',
      'MENTION': 'messageSquare',
      'ROLE_CHANGE': 'edit',
      'INFO': 'bell'
    };
    return mapeo[tipo] || 'bell';
  };

  const mapTipoAFiltro = (tipo) => {
    if (tipo.includes('TASK')) return 'TAREAS';
    if (tipo.includes('FILE')) return 'ARCHIVOS';
    if (tipo.includes('CALENDAR') || tipo.includes('EVENT')) return 'CALENDARIO';
    if (tipo.includes('TEAM') || tipo.includes('ROLE')) return 'EQUIPOS';
    return 'TODAS';
  };

  const obtenerIconoActividad = (icono) => {
    const iconos = {
      checkSquare: <FiCheckSquare />,
      upload: <FiUpload />,
      messageSquare: <FiMessageSquare />,
      calendar: <FiCalendar />,
      users: <FiUsers />,
      folder: <FiFolder />,
      edit: <FiEdit />,
      fileText: <FiFileText />,
      bell: <FiBell />
    };
    return iconos[icono] || <FiBell />;
  };

  const formatearFecha = (fecha) => {
    const ahora = new Date();
    const diferencia = ahora - fecha;
    const minutos = Math.floor(diferencia / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (minutos < 1) return 'Justo ahora';
    if (minutos < 60) return `Hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`;
    if (dias < 7) return `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
    return fecha.toLocaleDateString('es-MX', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const tiposFiltro = [
    { valor: 'TODAS', etiqueta: 'Todas' },
    { valor: 'TAREAS', etiqueta: 'Tareas' },
    { valor: 'ARCHIVOS', etiqueta: 'Archivos' },
    { valor: 'CALENDARIO', etiqueta: 'Calendario' },
    { valor: 'EQUIPOS', etiqueta: 'Equipos' }
  ];

  return (
    <div className="actividad-page">
      <div className="page-header">
        <h1>Feed de Actividad</h1>
        <p className="page-subtitle">
          Mantente al día con todas las actualizaciones de tus proyectos
        </p>
      </div>

      <div className="actividad-filtros">
        {tiposFiltro.map(tipo => (
          <button
            key={tipo.valor}
            className={`filtro-btn ${filtroTipo === tipo.valor ? 'activo' : ''}`}
            onClick={() => setFiltroTipo(tipo.valor)}
          >
            {tipo.etiqueta}
          </button>
        ))}
      </div>

      <div className="actividad-lista">
        {cargando ? (
          <div className="cargando">
            <div className="spinner"></div>
            <p>Cargando actividades...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <FiFileText size={48} />
            <p>{error}</p>
            <button onClick={cargarActividades} className="btn-reintentar">
              Reintentar
            </button>
          </div>
        ) : actividades.length === 0 ? (
          <div className="sin-actividades">
            <FiFileText size={48} />
            <p>No hay actividades recientes</p>
          </div>
        ) : (
          actividades.map(actividad => (
            <div 
              key={actividad.id} 
              className={`actividad-item ${!actividad.leida ? 'no-leida' : ''}`}
            >
              <div className="actividad-icono">
                {obtenerIconoActividad(actividad.icono)}
              </div>
              <div className="actividad-contenido">
                <div className="actividad-header">
                  <span className="actividad-titulo">
                    {actividad.titulo}
                  </span>
                  {!actividad.leida && (
                    <span className="badge-nuevo">Nuevo</span>
                  )}
                </div>
                <p className="actividad-descripcion">
                  {actividad.descripcion}
                </p>
                <div className="actividad-meta">
                  <span className="actividad-fecha">
                    {formatearFecha(actividad.fecha)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActividadPage;
