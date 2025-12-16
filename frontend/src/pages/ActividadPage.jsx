import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as ReactWindow from 'react-window';
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
import { getNotifications } from '../services/NotificationService';
import toast from 'react-hot-toast';
import ActivitySkeleton from '../components/skeletons/ActivitySkeleton';
import './ActividadPage.scss';

const ActividadPage = () => {
  const [filtroTipo, setFiltroTipo] = useState('TODAS');

  // Use React Query for data fetching with caching
  const { data: notificaciones = [], isLoading: cargando, error, refetch } = useQuery({
    queryKey: ['activities', filtroTipo],
    queryFn: async () => {
      const data = await getNotifications({ include_read: true, limit: 100 });
      return data;
    },
    onError: (err) => {
      console.error('Error cargando actividades:', err);
      toast.error('Error al cargar actividades');
    },
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute (formerly cacheTime in v4)
  });

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
  const actividades = filtroTipo !== 'TODAS'
    ? actividadesTransformadas.filter(act => mapTipoAFiltro(act.tipo) === filtroTipo)
    : actividadesTransformadas;

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

  // Virtual list row renderer for performance with large lists
  const ActivityRow = ({ index, style }) => {
    const actividad = actividades[index];
    return (
      <div 
        style={style}
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
    );
  };

  // Use virtual scrolling for large lists (> 20 items)
  const useVirtualScrolling = actividades.length > 20;
  
  // Calculate responsive height for virtual list (viewport height - header - padding)
  const virtualListHeight = typeof window !== 'undefined' 
    ? Math.min(window.innerHeight - 300, 800) 
    : 600;

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
          <ActivitySkeleton />
        ) : error ? (
          <div className="error-container">
            <FiFileText size={48} />
            <p>{error.message || 'No se pudieron cargar las actividades. Por favor, intenta de nuevo.'}</p>
            <button onClick={() => refetch()} className="btn-reintentar">
              Reintentar
            </button>
          </div>
        ) : actividades.length === 0 ? (
          <div className="sin-actividades">
            <FiFileText size={48} />
            <p>No hay actividades recientes</p>
          </div>
        ) : useVirtualScrolling ? (
          <ReactWindow.FixedSizeList
            height={virtualListHeight}
            itemCount={actividades.length}
            itemSize={120}
            width="100%"
          >
            {ActivityRow}
          </ReactWindow.FixedSizeList>
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
