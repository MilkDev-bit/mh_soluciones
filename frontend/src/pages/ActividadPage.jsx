import React, { useState, useEffect, useContext } from 'react';
import { 
  FiCheckSquare, 
  FiFileText, 
  FiCalendar, 
  FiUsers, 
  FiMessageSquare,
  FiFolder,
  FiUpload,
  FiEdit
} from 'react-icons/fi';
import { AuthContext } from '../contexts/AuthContext';
import './ActividadPage.scss';

const ActividadPage = () => {
  const { user } = useContext(AuthContext);
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('TODAS');

  useEffect(() => {
    cargarActividades();
  }, [filtroTipo]);

  const cargarActividades = async () => {
    try {
      setCargando(true);
      // TODO: Implementar llamada a la API para cargar actividades
      // const response = await fetch(`/api/actividades/?tipo=${filtroTipo}`);
      // const data = await response.json();
      
      // Datos de ejemplo por ahora
      const actividadesEjemplo = [
        {
          id: 1,
          tipo: 'TAREA_CREADA',
          usuario: { nombre: 'Juan Pérez', avatar: null },
          descripcion: 'creó la tarea "Implementar dashboard"',
          proyecto: 'Sistema de Gestión',
          fecha: new Date(Date.now() - 3600000),
          icono: 'checkSquare'
        },
        {
          id: 2,
          tipo: 'ARCHIVO_SUBIDO',
          usuario: { nombre: 'María González', avatar: null },
          descripcion: 'subió el archivo "reporte_mensual.pdf"',
          proyecto: 'Reportes Financieros',
          fecha: new Date(Date.now() - 7200000),
          icono: 'upload'
        },
        {
          id: 3,
          tipo: 'COMENTARIO_AGREGADO',
          usuario: { nombre: 'Carlos Ruiz', avatar: null },
          descripcion: 'comentó en la tarea "Revisión de código"',
          proyecto: 'Desarrollo Web',
          fecha: new Date(Date.now() - 10800000),
          icono: 'messageSquare'
        }
      ];
      
      setActividades(actividadesEjemplo);
    } catch (error) {
      console.error('Error cargando actividades:', error);
    } finally {
      setCargando(false);
    }
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
      fileText: <FiFileText />
    };
    return iconos[icono] || <FiFileText />;
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
        ) : actividades.length === 0 ? (
          <div className="sin-actividades">
            <FiFileText size={48} />
            <p>No hay actividades recientes</p>
          </div>
        ) : (
          actividades.map(actividad => (
            <div key={actividad.id} className="actividad-item">
              <div className="actividad-icono">
                {obtenerIconoActividad(actividad.icono)}
              </div>
              <div className="actividad-contenido">
                <div className="actividad-header">
                  <span className="actividad-usuario">
                    {actividad.usuario.nombre}
                  </span>
                  <span className="actividad-descripcion">
                    {actividad.descripcion}
                  </span>
                </div>
                <div className="actividad-meta">
                  <span className="actividad-proyecto">{actividad.proyecto}</span>
                  <span className="actividad-separador">•</span>
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
