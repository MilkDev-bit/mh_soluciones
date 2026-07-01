import React, { useState, useEffect, useContext, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  FiCheckSquare, 
  FiClock, 
  FiAlertCircle, 
  FiTrendingUp,
  FiUsers,
  FiFolder,
  FiDownload,
  FiAward,
  FiFileText,
  FiMaximize2,
  FiX,
  FiMove,
  FiRefreshCw,
  FiSave,
  FiBarChart2,
  FiCalendar,
  FiActivity
} from 'react-icons/fi';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement, 
  PointElement,
  Filler
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthContext } from '../contexts/AuthContext';
import { getStatistics } from '../services/reportService';
import { getProjects } from '../services/projectService';
import toast from 'react-hot-toast';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import logo from '../assets/img/logo.png';
import GeneralGraficasReports from '../components/reports/GeneralGraficasReports';
import './ReportesPage.scss';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement, 
  PointElement,
  Filler
);

const ReportesPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [rangoFecha, setRangoFecha] = useState('30_dias');
  const [proyectoFiltro, setProyectoFiltro] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const reporteRef = useRef();

  const { data: proyectosData } = useQuery({
    queryKey: ['projectsList'],
    queryFn: () => getProjects(),
    staleTime: 300000,
  });

  const { data: estadisticas, isLoading: cargando } = useQuery({
    queryKey: ['statistics', rangoFecha, proyectoFiltro],
    queryFn: () => getStatistics(rangoFecha, proyectoFiltro),
    onError: (error) => {
      console.error('Error cargando estadísticas:', error);
      toast.error('Error al cargar las estadísticas');
    },
    staleTime: 60000,
  });

  // --- Estados para tablas editables de reportes ---
  const [obrasSemana, setObrasSemana] = useState([]);
  const [duracionesProyectos, setDuracionesProyectos] = useState([]);
  const [calificacionCRI, setCalificacionCRI] = useState([]);

  // Plugin para mostrar valores sobre las barras
  const valueLabelPlugin = {
    id: 'valueLabelPlugin',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta.hidden) {
          meta.data.forEach((element, index) => {
            const value = dataset.data[index];
            if (value !== null && value !== undefined && value !== '' && Number(value) > 0) {
              ctx.save();
              ctx.fillStyle = dataset.borderColor || dataset.backgroundColor || '#2563eb';
              ctx.font = 'bold 10px Inter, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(value, element.x, element.y - 3);
              ctx.restore();
            }
          });
        }
      });
    }
  };

  const obtenerNumeroSemana = (dateString) => {
    if (!dateString) return 1;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 1;
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - startOfYear) / 86400000;
    return Math.max(1, Math.min(53, Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)));
  };

  const calcularObrasPorSemanaBD = () => {
    const semanas = Array.from({ length: 53 }, (_, i) => ({
      semana: `SEM ${i + 1}`,
      obras: 0
    }));
    const proyectos = proyectosData?.results || estadisticas?.proyectosDetalle || [];
    if (proyectos.length > 0) {
      proyectos.forEach(p => {
        if (p.status === 'IN_PROGRESS' || p.status === 'COMPLETED' || p.start_date || p.created_at) {
          const startW = obtenerNumeroSemana(p.start_date || p.created_at);
          const endW = p.status === 'COMPLETED' ? obtenerNumeroSemana(p.end_date || p.created_at) : 53;
          for (let w = startW; w <= endW && w <= 53; w++) {
            if (w >= 1) semanas[w - 1].obras += 1;
          }
        }
      });
    } else {
      const ejemplos = [11, 11, 13, 12, 8, 11, 16, 20, 27, 29, 30, 35, 40, 50, 53, 54, 58, 63, 65, 66, 68, 63, 61, 61, 59];
      ejemplos.forEach((val, idx) => {
        if (semanas[idx]) semanas[idx].obras = val;
      });
    }
    return semanas;
  };

  const calcularDuracionesBD = () => {
    const proyectos = estadisticas?.proyectosDetalle || proyectosData?.results || [];
    const filtrados = proyectos.filter(p => (p.start_date && p.end_date) || p.status === 'COMPLETED' || p.duracion_dias);
    if (filtrados.length > 0) {
      return filtrados.map(p => {
        let duracion = p.duracion_dias;
        if (!duracion) {
          const start = new Date(p.start_date || p.created_at || new Date());
          const end = new Date(p.end_date || p.created_at || new Date());
          duracion = Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
        }
        return {
          id: p.id || Math.random(),
          name: p.name || 'Proyecto',
          duracion: duracion
        };
      });
    } else {
      return [
        { id: 1, name: 'BAE JESUS TLATEMPA', duracion: 67 },
        { id: 2, name: 'BAE LAGO NAUR', duracion: 78 },
        { id: 3, name: 'BAE LAGO POJOJ', duracion: 80 },
        { id: 4, name: 'BA COSOLEACAQUE', duracion: 96 },
        { id: 5, name: 'BA COSTERA ACAPULCO', duracion: 132 },
        { id: 6, name: 'BAE TEKAX', duracion: 44 },
        { id: 7, name: 'BAE HACIENDA SAN MIGUEL', duracion: 81 },
        { id: 8, name: 'BAE MAYORGA MEXICALI', duracion: 86 }
      ];
    }
  };

  const calcularCRIBD = () => {
    const proyectos = estadisticas?.proyectosDetalle || proyectosData?.results || [];
    const completados = proyectos.filter(p => p.status === 'COMPLETED' || p.total_entregas > 0 || p.calificacion_cri !== undefined);
    if (completados.length > 0) {
      return completados.map(p => ({
        id: p.id || Math.random(),
        name: p.name || 'Proyecto',
        asignadas: p.total_entregas || 10,
        terminadas: p.terminadas || 8,
        vencidas: p.vencidas || 1,
        cri: p.calificacion_cri !== undefined ? p.calificacion_cri : 85
      }));
    } else {
      return [
        { id: 1, name: 'BAE JESUS TLATEMPA', asignadas: 15, terminadas: 15, vencidas: 0, cri: 100 },
        { id: 2, name: 'BAE LAGO NAUR', asignadas: 20, terminadas: 18, vencidas: 2, cri: 90 },
        { id: 3, name: 'BA COSOLEACAQUE', asignadas: 12, terminadas: 10, vencidas: 1, cri: 83 },
        { id: 4, name: 'SM CD OBREGON', asignadas: 8, terminadas: 8, vencidas: 0, cri: 100 }
      ];
    }
  };

  useEffect(() => {
    if (!proyectosData && !estadisticas) return;
    
    const guardadoObras = localStorage.getItem('reportes_obras_por_semana');
    if (guardadoObras) {
      try { setObrasSemana(JSON.parse(guardadoObras)); } catch (e) { setObrasSemana(calcularObrasPorSemanaBD()); }
    } else {
      setObrasSemana(calcularObrasPorSemanaBD());
    }

    const guardadoDuracion = localStorage.getItem('reportes_duracion_proyectos');
    if (guardadoDuracion) {
      try { setDuracionesProyectos(JSON.parse(guardadoDuracion)); } catch (e) { setDuracionesProyectos(calcularDuracionesBD()); }
    } else {
      setDuracionesProyectos(calcularDuracionesBD());
    }

    const guardadoCRI = localStorage.getItem('reportes_calificacion_cri');
    if (guardadoCRI) {
      try { setCalificacionCRI(JSON.parse(guardadoCRI)); } catch (e) { setCalificacionCRI(calcularCRIBD()); }
    } else {
      setCalificacionCRI(calcularCRIBD());
    }
  }, [proyectosData, estadisticas]);

  const guardarObrasSemana = () => {
    localStorage.setItem('reportes_obras_por_semana', JSON.stringify(obrasSemana));
    toast.success('Obras activas por semana guardadas correctamente');
  };

  const recargarObrasSemanaBD = () => {
    const nuevos = calcularObrasPorSemanaBD();
    setObrasSemana(nuevos);
    localStorage.removeItem('reportes_obras_por_semana');
    toast.info('Tabla recargada desde la base de datos');
  };

  const guardarDuraciones = () => {
    localStorage.setItem('reportes_duracion_proyectos', JSON.stringify(duracionesProyectos));
    toast.success('Duraciones de proyectos guardadas correctamente');
  };

  const recargarDuracionesBD = () => {
    const nuevos = calcularDuracionesBD();
    setDuracionesProyectos(nuevos);
    localStorage.removeItem('reportes_duracion_proyectos');
    toast.info('Duraciones recargadas desde la base de datos');
  };

  const guardarCRI = () => {
    localStorage.setItem('reportes_calificacion_cri', JSON.stringify(calificacionCRI));
    toast.success('Calificaciones CRI guardadas correctamente');
  };

  const recargarCRIBD = () => {
    const nuevos = calcularCRIBD();
    setCalificacionCRI(nuevos);
    localStorage.removeItem('reportes_calificacion_cri');
    toast.info('Calificaciones recargadas desde la base de datos');
  };

  const handleDragStart = (e, cardId) => {
    e.dataTransfer.setData("cardId", cardId);
    const dragImg = new Image();
    dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(dragImg, 0, 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const cardId = e.dataTransfer.getData("cardId");
    setExpandedCardId(cardId);
    toast.success('Módulo expandido para análisis', {
      icon: '🚀',
      style: { borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-primary)' }
    });
  };

  const getHealthState = (porcentaje) => {
    if(porcentaje >= 80) return { texto: 'Excelente', color: '#10b981' }; 
    if(porcentaje >= 50) return { texto: 'Aceptable', color: '#f59e0b' }; 
    return { texto: 'Crítico', color: '#ef4444' }; 
  };

  const obtenerTextoRango = (rango) => {
    const rangos = {
      '7_dias': 'Últimos 7 días',
      '30_dias': 'Últimos 30 días',
      '90_dias': 'Últimos 90 días',
      '12_meses': 'Últimos 12 meses'
    };
    return rangos[rango] || 'Últimos 30 días';
  };

  const exportarCSV = () => {
    if (!estadisticas) return toast.error('No hay datos para exportar');
    let csvContent = "data:text/csv;charset=utf-8,Metrica,Valor\n";
    csvContent += `Total de Tareas,${estadisticas.tareasTotales || 0}\n`;
    csvContent += `Tareas Completadas,${estadisticas.tareasCompletadas || 0}\n`;
    csvContent += `Tareas En Progreso,${estadisticas.tareasEnProgreso || 0}\n`;
    csvContent += `Tareas Vencidas,${estadisticas.tareasVencidas || 0}\n`;
    csvContent += `Tiempo Promedio Resolucion (Dias),${estadisticas.tiempoPromedioDias || 0}\n`;
    csvContent += `Porcentaje General (Salud),${estadisticas.porcentajeCompletado || 0}%\n`;
    
    if(estadisticas.tareasPorProyecto?.length > 0){
      csvContent += "\nProyecto,Tareas Asignadas\n";
      estadisticas.tareasPorProyecto.forEach(p => {
        csvContent += `${p.project_name},${p.task_count}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Estadisticas_${rangoFecha}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Excel descargado correctamente');
  };

  const exportarPDF = async () => {
    if (!estadisticas) return toast.error('No hay datos disponibles');
    try {
      toast.loading('Generando PDF profesional...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      pdf.setFontSize(22);
      pdf.text('Reporte Ejecutivo de Analytics', pageWidth / 2, 40, { align: 'center' });
      pdf.setFontSize(12);
      pdf.text(`Generado por: ${user?.first_name || 'Admin'}`, pageWidth / 2, 50, { align: 'center' });
      pdf.text(`Periodo: ${obtenerTextoRango(rangoFecha)}`, pageWidth / 2, 58, { align: 'center' });

      const proyectos = estadisticas?.tareasPorProyecto || [];
      const tableData = proyectos.map((p, i) => [i + 1, p.project_name, p.task_count, 'Activo']);
      
      autoTable(pdf, {
        startY: 70,
        head: [['#', 'Proyecto', 'Tareas', 'Estado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
      });

      pdf.save(`Reporte_Sistemas_${new Date().getTime()}.pdf`);
      toast.dismiss();
      toast.success('PDF generado');
    } catch (err) {
      toast.dismiss();
      toast.error('Error al generar PDF');
    }
  };

  const datosGraficoTareas = {
    labels: ['Completadas', 'En Progreso', 'Vencidas'],
    datasets: [{
      data: [estadisticas?.tareasCompletadas || 0, estadisticas?.tareasEnProgreso || 0, estadisticas?.tareasVencidas || 0],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      hoverOffset: 15,
      borderWidth: 0
    }]
  };

  const metricas = [
    { id: 'total', titulo: 'Total Tareas', valor: estadisticas?.tareasTotales || 0, icono: <FiCheckSquare />, color: '#3b82f6', link: '/tasks' },
    { id: 'completadas', titulo: 'Completadas', valor: estadisticas?.tareasCompletadas || 0, icono: <FiCheckSquare />, color: '#10b981', link: '/tasks?status=COMPLETED' },
    { id: 'vencidas', titulo: 'Vencidas', valor: estadisticas?.tareasVencidas || 0, icono: <FiAlertCircle />, color: '#ef4444', link: '/tasks?status=PENDING' },
    { id: 'proyectos', titulo: 'Proyectos Activos', valor: estadisticas?.proyectosActivos || 0, icono: <FiFolder />, color: '#8b5cf6', link: '/projects' }
  ];

  if (cargando) return <DashboardSkeleton />;

  return (
    <div className="reportes-page">
      <header className="page-header">
        <div className="header-title">
          <h1>Reportes</h1>
          <p className="page-subtitle">Panel de Control de Rendimiento Operativo</p>
        </div>

        <div className="header-acciones">
          <select className="rango-select" value={proyectoFiltro} onChange={(e) => setProyectoFiltro(e.target.value)}>
            <option value="">Todos los Proyectos</option>
            {proyectosData?.results?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select className="rango-select" value={rangoFecha} onChange={(e) => setRangoFecha(e.target.value)}>
            <option value="7_dias">7 Días</option>
            <option value="30_dias">30 Días</option>
            <option value="12_meses">12 Meses</option>
          </select>

          <div className="btn-group">
            <button className="btn-icon" onClick={exportarCSV} title="Excel"><FiFileText /></button>
            <button className="btn-icon" onClick={exportarPDF} title="PDF"><FiDownload /></button>
          </div>
        </div>
      </header>

      <section 
        className={`expansion-zone ${dragActive ? 'drag-active' : ''} ${expandedCardId ? 'filled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!expandedCardId ? (
          <div className="zone-placeholder">
            <div className="placeholder-icon"><FiMaximize2 /></div>
            <h3>Área de Análisis Profundo</h3>
            <p>Arrastra una métrica aquí para visualizar tendencias avanzadas</p>
          </div>
        ) : (
          <div className="expanded-view" ref={reporteRef}>
            <div className="view-header">
              <div className="badge-live">LIVE ANALYTICS</div>
              <h2>Análisis: {expandedCardId.toUpperCase()}</h2>
              <button className="close-btn" onClick={() => setExpandedCardId(null)}><FiX /></button>
            </div>
            
            <div className="view-body">
              <div className="main-chart-area">
                <Line 
                  data={{
                    labels: ['S1', 'S2', 'S3', 'S4'],
                    datasets: [{
                      label: 'Rendimiento',
                      data: estadisticas?.tendenciaSemanal || [10, 25, 15, 30],
                      borderColor: '#6366f1',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      fill: true,
                      tension: 0.4
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false }}
                />
              </div>
              
              <div className="side-data-area">
                <div className="score-widget">
                  <div className="score-value" style={{ color: getHealthState(estadisticas?.porcentajeCompletado).color }}>
                    {estadisticas?.porcentajeCompletado || 0}%
                  </div>
                  <div className="score-label">SALUD PROYECTO</div>
                </div>

                <div className="top-performers">
                  <h4><FiAward /> Rendimiento General</h4>
                  {estadisticas?.topPerformers?.length > 0 ? (
                    estadisticas.topPerformers.map((tp, idx) => (
                      <div key={idx} className="performer-item">
                        <span>{tp.name}</span>
                        <b>{tp.count}</b>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">Sin datos de usuarios</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="tarjetas-estadisticas">
        {metricas.map((m) => (
          <div 
            key={m.id} 
            className="tarjeta-estadistica" 
            draggable 
            onDragStart={(e) => handleDragStart(e, m.id)}
            onClick={() => m.link && navigate(m.link)}
          >
            <div className="card-drag-icon"><FiMove /></div>
            <div className="card-icon-box" style={{ backgroundColor: `${m.color}15`, color: m.color }}>
              {m.icono}
            </div>
            <div className="card-info">
              <h3>{m.titulo}</h3>
              <p className="valor">{m.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {!proyectoFiltro && (
        <div className="workload-section">
          <div className="section-header">
            <h3><FiFolder /> Carga Operativa por Proyecto</h3>
          </div>
          <div className="workload-chart">
            <Bar 
              data={{
                labels: estadisticas?.tareasPorProyecto?.map(p => p.project_name) || [],
                datasets: [{
                  label: 'Tareas',
                  data: estadisticas?.tareasPorProyecto?.map(p => p.task_count) || [],
                  backgroundColor: 'rgba(99, 102, 241, 0.8)',
                  borderRadius: 6
                }]
              }}
              options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>
      )}

      {/* SECCIÓN 1: OBRAS ACTIVAS POR SEMANA */}
      <div className="reportes-secciones-nuevas">
        <div className="reporte-seccion-card">
          <div className="seccion-top-header">
            <div className="titulo-seccion">
              <h3><FiActivity /> HISTÓRICO - OBRAS ACTIVAS POR SEMANA</h3>
              <span className="badge-subtitle">Tiempo Real / Editable</span>
            </div>
            <div className="acciones-seccion">
              <button className="btn-opcion" onClick={recargarObrasSemanaBD} title="Recargar desde los proyectos creados en BD">
                <FiRefreshCw /> Cargar desde BD
              </button>
              <button className="btn-opcion primary" onClick={guardarObrasSemana} title="Guardar cambios editados">
                <FiSave /> Guardar Cambios
              </button>
            </div>
          </div>

          <div className="seccion-grid-content">
            <div className="tabla-contenedor">
              <table className="tabla-editable">
                <thead>
                  <tr>
                    <th>SEMANA</th>
                    <th>OBRAS ACTIVAS</th>
                  </tr>
                </thead>
                <tbody>
                  {obrasSemana.map((row, idx) => (
                    <tr key={idx}>
                      <td className="td-label">{row.semana}</td>
                      <td>
                        <input
                          type="number"
                          className="input-editable"
                          value={row.obras}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setObrasSemana(prev => prev.map((item, i) => i === idx ? { ...item, obras: val } : item));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grafico-contenedor">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>
                OBRAS ACTIVAS POR SEMANA
              </h4>
              <div className="grafico-wrapper">
                <Bar
                  data={{
                    labels: obrasSemana.map(r => r.semana),
                    datasets: [{
                      label: 'Obras Activas',
                      data: obrasSemana.map(r => r.obras),
                      backgroundColor: '#2563eb',
                      borderColor: '#1d4ed8',
                      borderWidth: 1,
                      borderRadius: 4
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: { enabled: true }
                    },
                    scales: {
                      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                      x: { grid: { display: false } }
                    }
                  }}
                  plugins={[valueLabelPlugin]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: DURACIÓN PROYECTOS EN DÍAS */}
        <div className="reporte-seccion-card">
          <div className="seccion-top-header">
            <div className="titulo-seccion">
              <h3><FiCalendar /> DURACIÓN PROYECTOS (EN DÍAS)</h3>
              <span className="badge-subtitle">Fechas de Inicio / Cierre</span>
            </div>
            <div className="acciones-seccion">
              <button className="btn-opcion" onClick={recargarDuracionesBD}>
                <FiRefreshCw /> Cargar desde BD
              </button>
              <button className="btn-opcion primary" onClick={guardarDuraciones}>
                <FiSave /> Guardar Cambios
              </button>
            </div>
          </div>

          <div className="seccion-grid-content">
            <div className="tabla-contenedor">
              <table className="tabla-editable">
                <thead>
                  <tr>
                    <th>PROYECTO</th>
                    <th>DURACION EN DIAS</th>
                  </tr>
                </thead>
                <tbody>
                  {duracionesProyectos.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td className="td-label" style={{ fontSize: '0.8rem' }}>{row.name}</td>
                      <td>
                        <input
                          type="number"
                          className="input-editable"
                          value={row.duracion}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setDuracionesProyectos(prev => prev.map((item, i) => i === idx ? { ...item, duracion: val } : item));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grafico-contenedor">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>
                DURACIÓN POR PROYECTO (DÍAS)
              </h4>
              <div className="grafico-wrapper">
                <Bar
                  data={{
                    labels: duracionesProyectos.map(r => r.name),
                    datasets: [{
                      label: 'Días',
                      data: duracionesProyectos.map(r => r.duracion),
                      backgroundColor: '#16a34a',
                      borderColor: '#15803d',
                      borderWidth: 1,
                      borderRadius: 4
                    }]
                  }}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                      y: { grid: { display: false } }
                    }
                  }}
                  plugins={[valueLabelPlugin]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: CALIFICACIÓN FINAL DEL CRI POR PROYECTO COMPLETADO */}
        <div className="reporte-seccion-card">
          <div className="seccion-top-header">
            <div className="titulo-seccion">
              <h3><FiAward /> CALIFICACIÓN FINAL DEL CRI POR PROYECTO COMPLETADO</h3>
              <span className="badge-subtitle">Promedio de Cumplimiento</span>
            </div>
            <div className="acciones-seccion">
              <button className="btn-opcion" onClick={recargarCRIBD}>
                <FiRefreshCw /> Cargar desde BD
              </button>
              <button className="btn-opcion primary" onClick={guardarCRI}>
                <FiSave /> Guardar Cambios
              </button>
            </div>
          </div>

          <div className="seccion-grid-content full-width">
            <div className="tabla-contenedor" style={{ maxHeight: 'none' }}>
              <table className="tabla-editable">
                <thead>
                  <tr>
                    <th>PROYECTO COMPLETADO</th>
                    <th>ENTREGAS ASIGNADAS</th>
                    <th>ENTREGAS TERMINADAS</th>
                    <th>ENTREGAS VENCIDAS</th>
                    <th>CALIFICACIÓN CRI (%)</th>
                    <th>ESTADO CUMPLIMIENTO</th>
                  </tr>
                </thead>
                <tbody>
                  {calificacionCRI.map((row, idx) => {
                    const criVal = Number(row.cri) || 0;
                    let badgeColor = '#10b981';
                    let badgeText = 'ÓPTIMO';
                    if (criVal < 85) {
                      badgeColor = '#ef4444';
                      badgeText = 'RIESGO';
                    } else if (criVal < 95) {
                      badgeColor = '#f59e0b';
                      badgeText = 'ACEPTABLE';
                    }
                    return (
                      <tr key={row.id || idx}>
                        <td className="td-label" style={{ fontWeight: 800 }}>{row.name}</td>
                        <td>
                          <input
                            type="number"
                            className="input-editable"
                            value={row.asignadas}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCalificacionCRI(prev => prev.map((item, i) => i === idx ? { ...item, asignadas: val } : item));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input-editable"
                            value={row.terminadas}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCalificacionCRI(prev => prev.map((item, i) => i === idx ? { ...item, terminadas: val } : item));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input-editable"
                            value={row.vencidas}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCalificacionCRI(prev => prev.map((item, i) => i === idx ? { ...item, vencidas: val } : item));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input-editable"
                            style={{ fontWeight: 900, color: badgeColor }}
                            value={row.cri}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCalificacionCRI(prev => prev.map((item, i) => i === idx ? { ...item, cri: val } : item));
                            }}
                          />
                        </td>
                        <td>
                          <span style={{
                            background: `${badgeColor}15`,
                            color: badgeColor,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            border: `1px solid ${badgeColor}`
                          }}>
                            {badgeText} ({criVal}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: GRÁFICOS GENERALES DE GRAFICAS (CONSOLIDADO DE TODOS LOS PROYECTOS) */}
        <div style={{ marginTop: '40px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <FiActivity style={{ color: '#3b82f6', fontSize: '1.5rem' }} /> Gráficos Generales de Rendimiento e Incidencias (Consolidado de Proyectos)
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
              Consolidación automática en tiempo real de todas las tareas GRAFICAS en todos los proyectos
            </span>
          </div>
          <GeneralGraficasReports projects={proyectosData?.results || proyectosData || []} />
        </div>
      </div>
    </div>
  );
};

export default ReportesPage;