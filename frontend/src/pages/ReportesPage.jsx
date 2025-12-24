import { useState, useContext, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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

// Registrar componentes de Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

const ReportesPage = () => {
  const { user } = useContext(AuthContext);
  const [rangoFecha, setRangoFecha] = useState('30_dias');
  const reporteRef = useRef();

  // Use React Query for statistics
  const { data: estadisticas, isLoading: cargando } = useQuery({
    queryKey: ['statistics', rangoFecha],
    queryFn: () => getStatistics(rangoFecha),
    onError: (error) => {
      console.error('Error cargando estadísticas:', error);
      toast.error('Error al cargar las estadísticas');
    },
    staleTime: 60000, // 1 minute
  });

  // Función para formatear el rango de fecha en texto legible
  const obtenerTextoRango = (rango) => {
    const rangos = {
      '7_dias': 'Últimos 7 días',
      '30_dias': 'Últimos 30 días',
      '90_dias': 'Últimos 90 días',
      '12_meses': 'Últimos 12 meses'
    };
    return rangos[rango] || 'Últimos 30 días';
  };

  // Función para exportar a PDF mejorada
  const exportarPDF = async () => {
    try {
      toast.loading('Generando PDF profesional...');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // PÁGINA 1: Portada
      // Logo centrado
      const logoImg = new Image();
      logoImg.src = logo;
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = () => {
          console.warn('Error al cargar el logo');
          resolve(); // Continuar sin el logo
        };
      });
      pdf.addImage(logoImg, 'PNG', (pageWidth - 40) / 2, 30, 40, 40);
      
      // Título principal
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Reportes y Estadísticas', pageWidth / 2, 85, { align: 'center' });
      
      // Subtítulo
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Análisis detallado del progreso y rendimiento', pageWidth / 2, 95, { align: 'center' });
      
      // Metadata
      pdf.setFontSize(11);
      const today = new Date();
      const fechaGeneracion = today.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const rangoTexto = {
        '7_dias': 'Últimos 7 días',
        '30_dias': 'Últimos 30 días',
        '90_dias': 'Últimos 90 días',
        '12_meses': 'Últimos 12 meses'
      }[rangoFecha];
      
      pdf.text(`Fecha de generación: ${fechaGeneracion}`, pageWidth / 2, 120, { align: 'center' });
      pdf.text(`Período analizado: ${rangoTexto}`, pageWidth / 2, 128, { align: 'center' });
      pdf.text(`Generado por: ${user?.first_name || user?.username || 'Usuario'}`, pageWidth / 2, 136, { align: 'center' });
      
      // PÁGINA 2: Lista de Proyectos
      pdf.addPage();
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Proyectos Activos', 20, 20);
      
      // Obtener proyectos desde estadísticas o desde el servicio
      let proyectos = estadisticas?.tareasPorProyecto || [];
      
      // Si no hay proyectos en estadísticas, intentar obtenerlos del servicio
      if (proyectos.length === 0) {
        try {
          const proyectosData = await getProjects();
          proyectos = proyectosData.results?.map((p, idx) => ({
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
        // Preparar datos para la tabla
        const tableData = proyectos.map((proyecto, index) => [
          index + 1,
          proyecto.project_name,
          proyecto.task_count || 0,
          proyecto.status || 'Activo'
        ]);
        
        // Usar autoTable para una tabla profesional
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
      
      // PÁGINA 3+: Gráficos y Estadísticas
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Estadísticas y Gráficos', 20, 20);
      
      const elemento = reporteRef.current;
      if (!elemento) {
        throw new Error('No se pudo capturar el contenido del reporte');
      }
      
      const canvas = await html2canvas(elemento, {
        scale: 3,  // Mayor calidad
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: elemento.scrollWidth,
        windowHeight: elemento.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = pageWidth - 20; // Margen de 10mm a cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let position = 30;
      
      // Si la imagen es más alta que la página, dividirla
      if (imgHeight > pageHeight - 40) {
        let heightLeft = imgHeight;
        let srcY = 0;
        
        while (heightLeft > 0) {
          const pageContentHeight = pageHeight - 40;
          const heightToAdd = Math.min(heightLeft, pageContentHeight);
          
          // Crear canvas temporal para la porción actual
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          
          // Calcular la altura en píxeles del canvas original
          const scaleFactor = canvas.width / imgWidth;
          const srcHeight = heightToAdd * scaleFactor;
          
          tempCanvas.width = canvas.width;
          tempCanvas.height = srcHeight;
          
          // Copiar la porción relevante
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
      
      // Guardar PDF
      const rangoTextoFinal = rangoTexto || 'periodo-seleccionado';
      const fileName = `reporte-estadisticas-${rangoTextoFinal.toLowerCase().replace(/\s/g, '-')}-${today.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.dismiss();
      toast.success('PDF generado correctamente');
    } catch (error) {
      toast.dismiss();
      toast.error('Error al generar el PDF');
      console.error(error);
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
        </div>
      )}
    </div>
  );
};

export default ReportesPage;
