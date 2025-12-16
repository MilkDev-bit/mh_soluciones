import React, { useState, useEffect, useContext } from 'react';
import { 
  FiCheckSquare, 
  FiClock, 
  FiAlertCircle, 
  FiTrendingUp,
  FiUsers,
  FiFolder,
  FiDownload
} from 'react-icons/fi';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { AuthContext } from '../../contexts/AuthContext';
import './ReportesPage.scss';

// Registrar componentes de Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

const ReportesPage = () => {
  const { user } = useContext(AuthContext);
  const [cargando, setCargando] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [rangoFecha, setRangoFecha] = useState('30_dias');

  useEffect(() => {
    cargarEstadisticas();
  }, [rangoFecha]);

  const cargarEstadisticas = async () => {
    try {
      setCargando(true);
      // TODO: Implementar llamada a la API para cargar estadísticas
      // const response = await fetch(`/api/reportes/estadisticas/?rango=${rangoFecha}`);
      // const data = await response.json();
      
      // Datos de ejemplo
      const datosEjemplo = {
        tareasTotales: 145,
        tareasCompletadas: 98,
        tareasEnProgreso: 32,
        tareasVencidas: 15,
        proyectosActivos: 12,
        usuariosActivos: 24,
        porcentajeCompletado: 67.6
      };
      
      setEstadisticas(datosEjemplo);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setCargando(false);
    }
  };

  const datosGraficoTareas = {
    labels: ['Completadas', 'En Progreso', 'Vencidas'],
    datasets: [
      {
        data: [
          estadisticas?.tareasCompletadas || 0,
          estadisticas?.tareasEnProgreso || 0,
          estadisticas?.tareasVencidas || 0
        ],
        backgroundColor: [
          '#10b981',
          '#f59e0b',
          '#ef4444'
        ],
        borderWidth: 0
      }
    ]
  };

  const datosGraficoTendencia = {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
    datasets: [
      {
        label: 'Tareas Completadas',
        data: [20, 25, 28, 25],
        borderColor: '#ff7c15',
        backgroundColor: 'rgba(255, 124, 21, 0.1)',
        tension: 0.4
      }
    ]
  };

  const datosGraficoProyectos = {
    labels: ['Proyecto A', 'Proyecto B', 'Proyecto C', 'Proyecto D', 'Proyecto E'],
    datasets: [
      {
        label: 'Tareas por Proyecto',
        data: [30, 25, 20, 15, 10],
        backgroundColor: '#ff7c15'
      }
    ]
  };

  const opcionesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      }
    }
  };

  const tarjetasEstadisticas = [
    {
      titulo: 'Total de Tareas',
      valor: estadisticas?.tareasTotales || 0,
      icono: <FiCheckSquare />,
      color: '#3b82f6'
    },
    {
      titulo: 'Tareas Completadas',
      valor: estadisticas?.tareasCompletadas || 0,
      icono: <FiCheckSquare />,
      color: '#10b981'
    },
    {
      titulo: 'En Progreso',
      valor: estadisticas?.tareasEnProgreso || 0,
      icono: <FiClock />,
      color: '#f59e0b'
    },
    {
      titulo: 'Tareas Vencidas',
      valor: estadisticas?.tareasVencidas || 0,
      icono: <FiAlertCircle />,
      color: '#ef4444'
    },
    {
      titulo: 'Proyectos Activos',
      valor: estadisticas?.proyectosActivos || 0,
      icono: <FiFolder />,
      color: '#8b5cf6'
    },
    {
      titulo: 'Usuarios Activos',
      valor: estadisticas?.usuariosActivos || 0,
      icono: <FiUsers />,
      color: '#06b6d4'
    }
  ];

  return (
    <div className="reportes-page">
      <div className="page-header">
        <div>
          <h1>Reportes y Estadísticas</h1>
          <p className="page-subtitle">
            Análisis detallado del progreso y rendimiento del proyecto
          </p>
        </div>
        <div className="header-acciones">
          <select 
            className="rango-select"
            value={rangoFecha}
            onChange={(e) => setRangoFecha(e.target.value)}
          >
            <option value="7_dias">Últimos 7 días</option>
            <option value="30_dias">Últimos 30 días</option>
            <option value="90_dias">Últimos 90 días</option>
            <option value="12_meses">Últimos 12 meses</option>
          </select>
          <button className="btn-exportar">
            <FiDownload />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="cargando">
          <div className="spinner"></div>
          <p>Cargando estadísticas...</p>
        </div>
      ) : (
        <>
          <div className="tarjetas-estadisticas">
            {tarjetasEstadisticas.map((tarjeta, index) => (
              <div key={index} className="tarjeta-estadistica">
                <div className="tarjeta-icono" style={{ backgroundColor: tarjeta.color }}>
                  {tarjeta.icono}
                </div>
                <div className="tarjeta-contenido">
                  <h3>{tarjeta.titulo}</h3>
                  <p className="tarjeta-valor">{tarjeta.valor}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="graficos-container">
            <div className="grafico-card">
              <h3>Distribución de Tareas</h3>
              <div className="grafico">
                <Pie data={datosGraficoTareas} options={opcionesGrafico} />
              </div>
            </div>

            <div className="grafico-card grafico-grande">
              <h3>Tendencia de Completado</h3>
              <div className="grafico">
                <Line data={datosGraficoTendencia} options={opcionesGrafico} />
              </div>
            </div>

            <div className="grafico-card grafico-grande">
              <h3>Tareas por Proyecto</h3>
              <div className="grafico">
                <Bar data={datosGraficoProyectos} options={opcionesGrafico} />
              </div>
            </div>

            <div className="grafico-card">
              <h3>Progreso General</h3>
              <div className="progreso-general">
                <div className="progreso-circulo">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" strokeWidth="8"/>
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      fill="none" 
                      stroke="#ff7c15" 
                      strokeWidth="8"
                      strokeDasharray={`${(estadisticas?.porcentajeCompletado || 0) * 2.51} 251`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="progreso-texto">
                    <span className="progreso-porcentaje">
                      {estadisticas?.porcentajeCompletado || 0}%
                    </span>
                    <span className="progreso-etiqueta">Completado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesPage;
