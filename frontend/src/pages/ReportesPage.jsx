import React, { useState, useContext, useRef } from 'react';
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
  FiMove
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
    </div>
  );
};

export default ReportesPage;