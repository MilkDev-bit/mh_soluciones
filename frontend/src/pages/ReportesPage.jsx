import { useState, useContext, useRef } from 'react';
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
  FiFileText
} from 'react-icons/fi';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { AuthContext } from '../contexts/AuthContext';
import { getStatistics } from '../services/reportService';
import { getProjects } from '../services/projectService';
import toast from 'react-hot-toast';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import logo from '../assets/img/logo.png';
import './ReportesPage.scss';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

const ReportesPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [rangoFecha, setRangoFecha] = useState('30_dias');
  const [proyectoFiltro, setProyectoFiltro] = useState('');
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
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Metrica,Valor\n";
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
    if (!estadisticas || Object.keys(estadisticas).length === 0) {
      toast.error('No hay datos disponibles para generar el reporte');
      return;
    }

    try {
      toast.loading('Generando PDF profesional...');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const LOGO_LOAD_TIMEOUT = 3000;
      const logoImg = new Image();
      logoImg.src = logo;
      let logoLoaded = false;
      await new Promise((resolve) => {
        logoImg.onload = () => {
          logoLoaded = true;
          resolve();
        };
        logoImg.onerror = () => {
          if (import.meta.env.DEV) {
            console.warn('Could not load logo, continuing without it');
          }
          resolve();
        };
        setTimeout(resolve, LOGO_LOAD_TIMEOUT);
      });

      if (logoLoaded) {
        pdf.addImage(logoImg, 'PNG', (pageWidth - 40) / 2, 30, 40, 40);
      }
      
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Reportes y Estadísticas', pageWidth / 2, 85, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Análisis detallado del progreso y rendimiento', pageWidth / 2, 95, { align: 'center' });
      pdf.setFontSize(11);
      const today = new Date();
      const fechaGeneracion = today.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const rangoTexto = obtenerTextoRango(rangoFecha);
      
      pdf.text(`Fecha de generación: ${fechaGeneracion}`, pageWidth / 2, 120, { align: 'center' });
      pdf.text(`Período analizado: ${rangoTexto}`, pageWidth / 2, 128, { align: 'center' });
      pdf.text(`Generado por: ${user?.first_name || user?.username || 'Usuario'}`, pageWidth / 2, 136, { align: 'center' });
      pdf.addPage();
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Proyectos Activos', 20, 20);
      
      let proyectos = estadisticas?.tareasPorProyecto || [];
      
      if (proyectos.length === 0) {
        try {
          const proyectosDataQuery = await getProjects();
          proyectos = proyectosDataQuery.results?.map((p, idx) => ({
            project_name: p.name,
            task_count: p.task_count || 0,
            status: p.status || 'N/A',
            order: idx + 1
          })) || [];
        } catch (error) {
          console.warn('No se pudieron obtener proyectos:', error);
        }
      }
      
      let yPos = 35;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      if (proyectos.length > 0) {
        const tableData = proyectos.map((proyecto, index) => [
          index + 1,
          proyecto.project_name,
          proyecto.task_count || 0,
          proyecto.status || 'Activo'
        ]);
        
        pdf.autoTable({
          startY: 35,
          head: [['#', 'Nombre del Proyecto', 'Tareas', 'Estado']],
          body: tableData,
          theme: 'striped',
          headStyles: { 
            fillColor: [255, 124, 21],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: { 
            fontSize: 10,
            cellPadding: 3
          },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 30 },
            3: { cellWidth: 30 }
          },
          margin: { top: 35, left: 20, right: 20 }
        });
      } else {
        pdf.text('No hay proyectos disponibles', 25, yPos);
      }
      
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Estadísticas y Gráficos', 20, 20);
      
      const elemento = reporteRef.current;
      if (!elemento) {
        throw new Error('No se pudo capturar el contenido del reporte');
      }
      
      const canvas = await html2canvas(elemento, {
        scale: 3, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: elemento.scrollWidth,
        windowHeight: elemento.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let position = 30;
      
      if (imgHeight > pageHeight - 40) {
        let heightLeft = imgHeight;
        let srcY = 0;
        
        while (heightLeft > 0) {
          const pageContentHeight = pageHeight - 40;
          const heightToAdd = Math.min(heightLeft, pageContentHeight);
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          const scaleFactor = canvas.width / imgWidth;
          const srcHeight = heightToAdd * scaleFactor;
          
          tempCanvas.width = canvas.width;
          tempCanvas.height = srcHeight;
          
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcHeight, 0, 0, canvas.width, srcHeight);
          const tempImgData = tempCanvas.toDataURL('image/png', 1.0);
          
          pdf.addImage(tempImgData, 'PNG', 10, position, imgWidth, heightToAdd);
          
          heightLeft -= heightToAdd;
          srcY += srcHeight;
          
          if (heightLeft > 0) {
            pdf.addPage();
            position = 10;
          }
        }
      } else {
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      }
      
      const rangoTextoFinal = rangoTexto || 'periodo-seleccionado';
      const fileName = `reporte-estadisticas-${rangoTextoFinal.toLowerCase().replace(/\s/g, '-')}-${today.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.dismiss();
      toast.success('PDF generado correctamente');
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Error al generar el PDF';
      
      if (error.name === 'SecurityError') {
        errorMessage = 'Error de seguridad al generar el PDF. Intente descargar desde una conexión segura.';
      } else if (error.message?.includes('canvas')) {
        errorMessage = 'Error al procesar los gráficos. Intente nuevamente.';
      } else if (error.message?.includes('logo')) {
        errorMessage = 'Error al cargar el logo. El PDF se generará sin logo.';
      }
      
      toast.error(errorMessage);
      
      if (import.meta.env.DEV) {
        console.error('PDF Generation Error:', error);
      }
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
        data: estadisticas?.tendenciaSemanal || [0, 0, 0, 0],
        borderColor: '#ff7c15',
        backgroundColor: 'rgba(255, 124, 21, 0.1)',
        tension: 0.4
      }
    ]
  };

  const datosGraficoProyectos = {
    labels: estadisticas?.tareasPorProyecto?.map(p => p.project_name) || [],
    datasets: [
      {
        label: 'Tareas por Proyecto',
        data: estadisticas?.tareasPorProyecto?.map(p => p.task_count) || [],
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

  const opcionesBarrasHorizontales = {
    ...opcionesGrafico,
    indexAxis: 'y',
    plugins: { legend: { display: false } }
  };

  const tarjetasEstadisticas = [
    { titulo: 'Total de Tareas', valor: estadisticas?.tareasTotales || 0, icono: <FiCheckSquare />, color: '#3b82f6', link: '/tasks' },
    { titulo: 'Tareas Completadas', valor: estadisticas?.tareasCompletadas || 0, icono: <FiCheckSquare />, color: '#10b981', link: '/tasks?status=COMPLETED' },
    { titulo: 'En Progreso', valor: estadisticas?.tareasEnProgreso || 0, icono: <FiClock />, color: '#f59e0b', link: '/tasks?status=IN_PROGRESS' },
    { titulo: 'Tareas Vencidas', valor: estadisticas?.tareasVencidas || 0, icono: <FiAlertCircle />, color: '#ef4444', link: '/tasks?status=PENDING' },
    { titulo: 'Promedio Cierre', valor: `${estadisticas?.tiempoPromedioDias || 0} días`, icono: <FiTrendingUp />, color: '#6366f1', link: null },
    { titulo: 'Proyectos Activos', valor: estadisticas?.proyectosActivos || 0, icono: <FiFolder />, color: '#06b6d4', link: '/projects' }
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
        <div className="header-acciones" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          
          <select 
            className="rango-select" 
            value={proyectoFiltro} 
            onChange={(e) => setProyectoFiltro(e.target.value)}
            style={{ minWidth: '180px' }}
          >
            <option value="">Todos los Proyectos</option>
            {proyectosData?.results?.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

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

          <button className="btn-exportar" style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#10b981' }} onClick={exportarCSV}>
            <FiFileText /> <span>Excel</span>
          </button>

          <button className="btn-exportar" onClick={exportarPDF}>
            <FiDownload />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {cargando ? (
        <DashboardSkeleton />
      ) : (
        <div ref={reporteRef}>
          
          <div className="tarjetas-estadisticas">
            {tarjetasEstadisticas.map((tarjeta, index) => (
              <div 
                key={index} 
                className="tarjeta-estadistica"
                style={{ cursor: tarjeta.link ? 'pointer' : 'default', transition: 'transform 0.2s' }}
                onClick={() => tarjeta.link && navigate(tarjeta.link)}
                onMouseEnter={(e) => tarjeta.link && (e.currentTarget.style.transform = 'translateY(-5px)')}
                onMouseLeave={(e) => tarjeta.link && (e.currentTarget.style.transform = 'translateY(0)')}
              >
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

          <div className="graficos-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
            
            <div className="grafico-card grafico-grande" style={{ position: 'relative' }}>
              <h3>Distribución de Tareas</h3>
              <div className="grafico" style={{ position: 'relative', height: '300px' }}>
                <Pie data={datosGraficoTareas} options={{...opcionesGrafico, cutout: '70%'}} />
                
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <span style={{ display: 'block', fontSize: '2rem', fontWeight: 'bold', color: getHealthState(estadisticas?.porcentajeCompletado || 0).color }}>
                      {estadisticas?.porcentajeCompletado || 0}%
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#6b7280' }}>
                      {getHealthState(estadisticas?.porcentajeCompletado || 0).texto}
                    </span>
                </div>
              </div>
            </div>

            <div className="grafico-card grafico-grande">
              <h3>Tendencia de Completado</h3>
              <div className="grafico" style={{ height: '300px' }}>
                <Line data={datosGraficoTendencia} options={opcionesGrafico} />
              </div>
            </div>

            {estadisticas?.topPerformers?.length > 0 && (
              <div className="grafico-card grafico-grande" style={{ padding: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FiAward color="#f59e0b"/> Top Rendimiento
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                  {estadisticas.topPerformers.map((user, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontWeight: '500' }}>{idx + 1}. {user.name}</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>{user.count} tareas</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {!proyectoFiltro && (
            <div className="grafico-card grafico-grande" style={{ marginTop: '20px', width: '100%' }}>
              <h3>Carga Operativa por Proyecto</h3>
              <div className="grafico" style={{ height: `${Math.max(300, (estadisticas?.tareasPorProyecto?.length || 0) * 40)}px` }}>
                <Bar data={datosGraficoProyectos} options={opcionesBarrasHorizontales} />
              </div>
            </div>
          )}
          
        </div>
      )}
    </div>
  );
};

export default ReportesPage;