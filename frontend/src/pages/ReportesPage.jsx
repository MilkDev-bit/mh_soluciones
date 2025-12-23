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
import html2canvas from 'html2canvas';
import { AuthContext } from '../contexts/AuthContext';
import { getStatistics } from '../services/reportService';
import toast from 'react-hot-toast';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import logo from '../assets/img/logo.png';
import './ReportesPage.scss';

// Registrar componentes de Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

// Opciones de configuración para html2canvas
const HTML2CANVAS_OPTIONS = {
  scale: 2,
  useCORS: true,
  logging: false
};

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

  // Función para exportar a PDF
  const exportarPDF = async () => {
    const toastId = toast.loading('Generando PDF...');
    
    try {
      // Capturar el contenido del reporte
      const elemento = reporteRef.current;
      if (!elemento) {
        toast.error('No se pudo capturar el contenido del reporte', { id: toastId });
        return;
      }

      // Convertir el elemento HTML a canvas
      let canvas;
      try {
        canvas = await html2canvas(elemento, HTML2CANVAS_OPTIONS);
      } catch (canvasError) {
        console.error('Error al capturar el contenido:', canvasError);
        toast.error('Error al capturar el contenido de la página. Intente nuevamente.', { id: toastId });
        return;
      }

      // Crear PDF en formato A4 vertical
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Agregar logo
      const logoSize = 30; // 30mm
      const logoX = 15;
      const logoY = 15;
      
      // Cargar y agregar logo al PDF
      try {
        pdf.addImage(logo, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch (logoError) {
        console.warn('Error al agregar logo, continuando sin él:', logoError);
        // Continuar sin el logo si falla
      }

      // Agregar título
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Reportes y Estadísticas', logoX + logoSize + 10, logoY + 10);

      // Agregar metadata
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const fechaGeneracion = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
      pdf.text(`Fecha de generación: ${fechaGeneracion}`, logoX + logoSize + 10, logoY + 20);
      pdf.text(`Rango de fechas: ${obtenerTextoRango(rangoFecha)}`, logoX + logoSize + 10, logoY + 27);

      // Calcular dimensiones para la imagen del contenido
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 30; // Márgenes de 15mm a cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const contentY = logoY + logoSize + 20; // Posición Y después del header

      // Agregar imagen del contenido capturado
      if (contentY + imgHeight > pageHeight) {
        // La imagen es demasiado alta para caber en una sola página
        // Dividir en múltiples páginas
        
        // Primera página: agregar lo que cabe después del header
        const firstPageHeight = pageHeight - contentY - 15;
        pdf.addImage(imgData, 'PNG', 15, contentY, imgWidth, Math.min(imgHeight, firstPageHeight));
        
        // Páginas siguientes: procesar el contenido restante
        let remainingHeight = imgHeight - firstPageHeight;
        let processedHeight = firstPageHeight; // Altura procesada en coordenadas PDF (mm)
        
        while (remainingHeight > 0) {
          pdf.addPage();
          const heightToAdd = Math.min(remainingHeight, pageHeight - 30);
          
          // Transformación de coordenadas: convertir de PDF (mm) a canvas (píxeles)
          // El canvas es más grande que la imagen PDF debido al factor de escala
          const canvasScaleFactor = canvas.width / imgWidth; // Relación píxeles/mm
          const sourceY = processedHeight * canvasScaleFactor; // Posición Y en píxeles
          const sourceHeight = heightToAdd * canvasScaleFactor; // Altura a copiar en píxeles
          
          // Crear un canvas temporal para extraer la porción del contenido
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          tempCanvas.width = canvas.width;
          tempCanvas.height = sourceHeight;
          
          // Copiar la sección relevante del canvas original al temporal
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          const tempImgData = tempCanvas.toDataURL('image/png');
          
          // Agregar la sección al PDF
          pdf.addImage(tempImgData, 'PNG', 15, 15, imgWidth, heightToAdd);
          remainingHeight -= heightToAdd;
          processedHeight += heightToAdd;
        }
      } else {
        // La imagen cabe completamente en la primera página
        pdf.addImage(imgData, 'PNG', 15, contentY, imgWidth, imgHeight);
      }

      // Descargar PDF
      const nombreArchivo = `reporte-estadisticas-${rangoFecha}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(nombreArchivo);

      toast.success('PDF generado exitosamente', { id: toastId });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF. Por favor, intente nuevamente.', { id: toastId });
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
