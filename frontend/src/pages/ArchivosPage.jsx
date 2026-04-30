import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  FiFile,
  FiUpload,
  FiDownload,
  FiTrash2,
  FiSearch,
  FiGrid,
  FiList,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiExternalLink
} from 'react-icons/fi';
import { useDropzone } from 'react-dropzone';
import { getAllDocuments, uploadDocument, deleteDocument, getFoldersForProject } from '../services/documentService';
import { getProjects } from '../services/projectService';
import { handleViewFile, forceDownloadFile, downloadFilesAsZip } from '../utils/fileUtils';
import toast from 'react-hot-toast';
import { FILTER_TYPES } from '../constants/folderTypes';
import PdfThumbnail from '../components/common/PdfThumbnail';
import './ArchivosPage.scss';

const ArchivosPage = () => {
  const { user: currentUser } = useAuth();
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaTipo, setVistaTipo] = useState('grid'); // 'grid' o 'list'
  const [filtroTipo, setFiltroTipo] = useState(FILTER_TYPES.ALL);
  const [filtroCarpeta, setFiltroCarpeta] = useState('ALL'); // Changed to use string IDs
  const [busqueda, setBusqueda] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [carpetasDrive, setCarpetasDrive] = useState([]); // Dynamic folders from Drive
  const [cargandoCarpetas, setCargandoCarpetas] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState('all'); // 'all', 'week', 'month', '3months', '6months', 'year', 'custom'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [errorFecha, setErrorFecha] = useState('');
  const [imageErrors, setImageErrors] = useState({});
  const [visibleCount, setVisibleCount] = useState(50);
  const debounceTimer = useRef(null);
  const isFirstLoad = useRef(true);

  // Resetea el conteo de elementos visibles cuando cambian los filtros
  useEffect(() => {
    setVisibleCount(50);
  }, [busqueda, filtroTipo, filtroCarpeta, filtroFecha, fechaDesde, fechaHasta, proyectoSeleccionado]);

  // Helper para calcular fechas de rangos predefinidos
  const calcularFechaDesde = (rangoTipo) => {
    let hoy;
    switch (rangoTipo) {
      case 'week':
        hoy = new Date();
        hoy.setDate(hoy.getDate() - 7);
        hoy.setHours(0, 0, 0, 0);
        return hoy;
      case 'month':
        hoy = new Date();
        hoy.setMonth(hoy.getMonth() - 1);
        hoy.setHours(0, 0, 0, 0);
        return hoy;
      case '3months':
        hoy = new Date();
        hoy.setMonth(hoy.getMonth() - 3);
        hoy.setHours(0, 0, 0, 0);
        return hoy;
      case '6months':
        hoy = new Date();
        hoy.setMonth(hoy.getMonth() - 6);
        hoy.setHours(0, 0, 0, 0);
        return hoy;
      case 'year':
        hoy = new Date();
        hoy.setFullYear(hoy.getFullYear() - 1);
        hoy.setHours(0, 0, 0, 0);
        return hoy;
      default:
        return null;
    }
  };

  // Función para manejar cambios en el filtro de fecha
  const handleFiltroFechaChange = (value) => {
    setFiltroFecha(value);
    setErrorFecha('');

    // Reset custom dates when switching to predefined range
    if (value !== 'custom') {
      setFechaDesde('');
      setFechaHasta('');
    }
  };

  // Función para validar rango de fechas personalizadas
  const validarFechasPersonalizadas = useCallback(() => {
    if (filtroFecha === 'custom' && fechaDesde && fechaHasta) {
      const desde = new Date(fechaDesde);
      const hasta = new Date(fechaHasta);

      if (desde > hasta) {
        setErrorFecha('La fecha desde no puede ser posterior a la fecha hasta');
        return false;
      }
    }
    setErrorFecha('');
    return true;
  }, [filtroFecha, fechaDesde, fechaHasta]);

  const cargarProyectos = async () => {
    try {
      const data = await getProjects();
      // Handle both array and paginated response
      const proyectosList = Array.isArray(data) ? data : (data.results || []);
      setProyectos(proyectosList);
    } catch (error) {
      console.error('Error cargando proyectos:', error);
      toast.error('Error al cargar proyectos');
    }
  };

  const cargarCarpetasDrive = useCallback(async (projectId) => {
    if (!projectId) {
      setCarpetasDrive([]);
      setFiltroCarpeta('ALL');
      return;
    }

    try {
      setCargandoCarpetas(true);
      const folders = await getFoldersForProject(projectId);
      // Actualizar carpetas SIN cambiar filtroCarpeta aquí para evitar re-fetch en cadena
      setCarpetasDrive(folders);
    } catch (error) {
      console.error('Error cargando carpetas:', error);

      if (error.statusCode === 403) {
        toast.error('No tiene permisos para ver las carpetas de este proyecto');
        setCarpetasDrive([]);
      } else if (error.type === 'refresh_error') {
        toast.error('Error de autenticación con Google Drive. Contacte al administrador.');
        setCarpetasDrive([]);
      } else if (error.type === 'permission_error') {
        toast.error('Sin permisos para acceder a Google Drive. Contacte al administrador.');
        setCarpetasDrive([]);
      } else {
        setCarpetasDrive([]);
      }
    } finally {
      setCargandoCarpetas(false);
    }
  }, []);

  const cargarArchivos = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      // Build query params based on folder_type mapping
      const params = { page_size: 1000 };

      // Apply type filter if selected (IMAGENES, DOCUMENTOS, etc.)
      if (filtroTipo !== FILTER_TYPES.ALL) {
        params.folder_type = filtroTipo;
      }

      // Filter by selected project
      if (proyectoSeleccionado) {
        params.project = proyectoSeleccionado;
      }

      // Filter by selected Drive folder (send folder ID to backend)
      // Only send if it's a real Drive folder ID, not a static filter
      if (filtroCarpeta && filtroCarpeta !== 'ALL' && !filtroCarpeta.startsWith('STATIC_') && carpetasDrive.length > 0) {
        params.drive_folder_id = filtroCarpeta;
      }

      // For static folder filters, send folder_name so backend can filter by
      // drive_parent_folder_name OR task title (icontains), covering all upload paths
      if (filtroCarpeta && filtroCarpeta.startsWith('STATIC_')) {
        params.folder_name = filtroCarpeta.replace('STATIC_', '');
      }

      const documentos = await getAllDocuments(params);
      setArchivos(documentos);
    } catch (error) {
      console.error('Error cargando archivos:', error);
      setError('No se pudieron cargar los archivos. Por favor, intenta de nuevo.');
      toast.error('Error al cargar archivos');
    } finally {
      setCargando(false);
    }
  }, [filtroTipo, proyectoSeleccionado, filtroCarpeta, carpetasDrive]);

  useEffect(() => {
    cargarProyectos();
  }, []);

  // Cuando cambia el proyecto: cargar carpetas y luego recargar archivos
  // Se usa un handler explícito en el select para evitar el doble-fetch en cadena
  const handleProyectoChange = useCallback(async (projectId) => {
    setProyectoSeleccionado(projectId || null);
    setFiltroCarpeta('ALL');
    if (projectId) {
      await cargarCarpetasDrive(projectId);
    } else {
      setCarpetasDrive([]);
    }
  }, [cargarCarpetasDrive]);

  // Debounce: espera 300ms después del último cambio de filtro antes de llamar a la API
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      cargarArchivos();
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      cargarArchivos();
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [cargarArchivos]);


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (archivosAceptados) => {
      if (archivosAceptados.length === 0) return;

      // Validate project is selected
      if (!proyectoSeleccionado) {
        toast.error('Por favor selecciona un proyecto primero');
        return;
      }

      setSubiendo(true);
      try {
        // Get the selected folder name for display
        const carpetaSeleccionada = carpetasDrive.find(c => c.id === filtroCarpeta);
        const nombreCarpetaDestino = carpetaSeleccionada?.name || null;

        // Upload each file
        const promises = archivosAceptados.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);

          // Determine folder_type for upload
          // Use the type filter if it's not 'ALL', otherwise use default DOCUMENTS
          const selectedFolderType = filtroTipo !== FILTER_TYPES.ALL
            ? filtroTipo
            : FILTER_TYPES.DOCUMENTS;
          formData.append('folder_type', selectedFolderType);

          // Add project ID (required)
          formData.append('project', proyectoSeleccionado);

          // Add target folder ID if a specific folder is selected
          // Only send if it's not 'ALL' and not a STATIC folder, and we have actual folder data
          if (filtroCarpeta && filtroCarpeta !== 'ALL' && !filtroCarpeta.startsWith('STATIC_') && carpetasDrive.length > 0) {
            formData.append('target_folder_id', filtroCarpeta);
          }

          return uploadDocument(formData);
        });

        await Promise.all(promises);

        // Show success message with folder destination
        if (nombreCarpetaDestino) {
          toast.success(
            `${archivosAceptados.length} archivo(s) subido(s) correctamente a la carpeta "${nombreCarpetaDestino}"`
          );
        } else {
          toast.success(
            `${archivosAceptados.length} archivo(s) subido(s) correctamente`
          );
        }

        // Recargar archivos después de la subida
        await cargarArchivos();
      } catch (error) {
        console.error('Error subiendo archivos:', error);

        // Show specific error message based on error type
        let errorMessage = 'No se pudo subir el documento - Verifique acceso/estructura en Drive';

        if (error.type === 'refresh_error') {
          errorMessage = 'No se pudo subir el documento - Las credenciales de Google Drive han expirado. Contacte al administrador.';
        } else if (error.type === 'permission_error') {
          errorMessage = 'No se pudo subir el documento - Sin permisos para acceder a Google Drive. Contacte al administrador.';
        } else if (error.type === 'folder_error') {
          errorMessage = 'No se pudo subir el documento - Error al acceder a la carpeta del proyecto en Drive. Verifique la estructura.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        toast.error(errorMessage);
      } finally {
        setSubiendo(false);
      }
    },
    disabled: !proyectoSeleccionado,
    maxSize: 40 * 1024 * 1024, // 40MB
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'text/plain': ['.txt']
    }
  });

  const handleDeleteArchivo = async (archivoId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este archivo?')) {
      return;
    }

    try {
      await deleteDocument(archivoId);
      toast.success('Archivo eliminado correctamente');
      await cargarArchivos();
    } catch (error) {
      console.error('Error eliminando archivo:', error);
      toast.error('Error al eliminar el archivo');
    }
  };

  const handleDownloadArchivo = async (archivo) => {
    try {
      await handleViewFile(archivo);
    } catch (error) {
      console.error('Error descargando archivo:', error);
      toast.error('Error al procesar el archivo');
    }
  };

  const formatearTamano = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const tamaños = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + tamaños[i];
  };

  const obtenerIconoArchivo = (tipo) => {
    if (!tipo) return '📁';
    if (tipo.startsWith('image/')) return '🖼️';
    if (tipo.includes('pdf')) return '📄';
    if (tipo.includes('word')) return '📝';
    if (tipo.includes('excel') || tipo.includes('spreadsheet')) return '📊';
    if (tipo.includes('powerpoint') || tipo.includes('presentation')) return '📊';
    if (tipo.includes('zip') || tipo.includes('rar')) return '📦';
    return '📁';
  };

  const obtenerThumbnail = (archivo) => {
    const tipo = archivo.file_type || '';
    const url = archivo.file_url || archivo.drive_file_url || '';

    if (tipo.startsWith('image/') && url) {
      if (imageErrors[archivo.id]) {
        return <span className="icono-tipo-grande">{obtenerIconoArchivo(tipo)}</span>;
      }
      return (
        <img
          src={url}
          alt={archivo.name}
          className="archivo-thumbnail-img"
          onError={() => setImageErrors(prev => ({ ...prev, [archivo.id]: true }))}
        />
      );
    }

    if (tipo.includes('pdf') && url) {
      return (
        <PdfThumbnail
          url={url}
          fileName={archivo.name}
          fallbackIcon={obtenerIconoArchivo(tipo)}
        />
      );
    }

    return (
      <span className="icono-tipo-grande">{obtenerIconoArchivo(tipo)}</span>
    );
  };

  const obtenerEstadoDrive = (estado) => {
    switch (estado) {
      case 'COMPLETE':
        return <span className="estado-badge completo"><FiCheckCircle /> Sincronizado</span>;
      case 'UPLOADING':
        return <span className="estado-badge subiendo"><FiClock /> Subiendo...</span>;
      case 'FAILED':
        return <span className="estado-badge fallido"><FiAlertCircle /> Fallo</span>;
      case 'PENDING':
        return <span className="estado-badge pendiente"><FiClock /> Pendiente</span>;
      default:
        return <span className="estado-badge pendiente"><FiClock /> Pendiente</span>;
    }
  };

  // Memoize the date limit calculation for better performance
  const fechaLimiteCalculada = useMemo(() => {
    if (filtroFecha === 'all' || filtroFecha === 'custom') {
      return null;
    }
    return calcularFechaDesde(filtroFecha);
  }, [filtroFecha]);

  const archivosFiltrados = useMemo(() => {
    // Preparar variables de filtrado fuera del loop para mejor rendimiento
    const busquedaLower = busqueda.toLowerCase();
    
    let isStaticFolder = false;
    let targetNameStatic = '';
    
    if (filtroCarpeta && filtroCarpeta.startsWith('STATIC_')) {
      isStaticFolder = true;
      targetNameStatic = (filtroCarpeta.replace('STATIC_', '') || '').normalize('NFC').toLowerCase();
    }
    
    const normalizeStr = (str) => (str || '').normalize('NFC').toLowerCase();

    return archivos.filter(archivo => {
      // Búsqueda general
      if (busquedaLower) {
        const nombreArchivo = (archivo.name || '').toLowerCase();
        const proyectoNombre = (archivo.project_info?.name || '').toLowerCase();
        
        if (!nombreArchivo.includes(busquedaLower) && !proyectoNombre.includes(busquedaLower)) {
          return false;
        }
      }

      // Filtro por tipo de carpeta
      if (filtroTipo !== FILTER_TYPES.ALL) {
        if (archivo.folder_type !== filtroTipo) {
          return false;
        }
      }

      // Filtro por carpeta de Drive seleccionada
      if (filtroCarpeta && filtroCarpeta !== 'ALL') {
        if (isStaticFolder) {
          const driveParent = normalizeStr(archivo.drive_parent_folder_name);
          const folderType = normalizeStr(archivo.folder_type);
          const name = normalizeStr(archivo.name);
          const taskName = normalizeStr(archivo.task_name);
          
          if (!driveParent.includes(targetNameStatic) && 
              !folderType.includes(targetNameStatic) && 
              !name.includes(targetNameStatic) && 
              !taskName.includes(targetNameStatic)) {
            return false;
          }
        } else if (carpetasDrive.length > 0) {
          if (archivo.drive_parent_folder_id !== filtroCarpeta) {
            return false;
          }
        }
      }

      // Filtro por fecha
      if (filtroFecha !== 'all' && archivo.created_at) {
        const fechaArchivo = new Date(archivo.created_at);

        if (filtroFecha === 'custom') {
          // No aplicar si hay error de validación
          if (!errorFecha) {
            if (fechaDesde) {
              const fechaDesdeInicio = new Date(fechaDesde);
              fechaDesdeInicio.setHours(0, 0, 0, 0);
              if (fechaArchivo < fechaDesdeInicio) return false;
            }
            if (fechaHasta) {
              const fechaHastaFin = new Date(fechaHasta);
              fechaHastaFin.setHours(23, 59, 59, 999);
              if (fechaArchivo > fechaHastaFin) return false;
            }
          }
        } else {
          if (fechaLimiteCalculada && fechaArchivo < fechaLimiteCalculada) {
            return false;
          }
        }
      }

      return true;
    });
  }, [archivos, busqueda, filtroTipo, filtroCarpeta, carpetasDrive, filtroFecha, fechaDesde, fechaHasta, errorFecha, fechaLimiteCalculada]);

  const archivosMostrados = archivosFiltrados.slice(0, visibleCount);

  return (
    <div className="archivos-page">
      <div className="page-header">
        <div>
          <h1>Centro de Archivos</h1>
          <p className="page-subtitle">
            Gestiona y organiza todos tus documentos con sincronización a Google Drive
          </p>
        </div>
      </div>

      <div className="archivos-toolbar">
        <div className="toolbar-izquierda">
          <div className="proyecto-filter-container">
            <label htmlFor="proyecto-filter">Proyecto:</label>
            <select
              id="proyecto-filter"
              value={proyectoSeleccionado || ''}
              onChange={(e) => handleProyectoChange(e.target.value)}
              className="proyecto-select"
            >
              <option value="">Todos los proyectos</option>
              {proyectos.map(proyecto => (
                <option key={proyecto.id} value={proyecto.id}>
                  {proyecto.name}
                </option>
              ))}
            </select>
          </div>
          <div className="busqueda-container">
            <FiSearch />
            <input
              type="text"
              placeholder="Buscar archivos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <select
            className="filtro-tipo"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value={FILTER_TYPES.ALL}>Todos los tipos</option>
            <option value={FILTER_TYPES.IMAGES}>Imágenes</option>
            <option value={FILTER_TYPES.DOCUMENTS}>Documentos</option>
            <option value={FILTER_TYPES.VIDEOS}>Videos</option>
            <option value={FILTER_TYPES.FILES}>Archivos</option>
          </select>
          <select
            className="filtro-carpeta"
            value={filtroCarpeta}
            onChange={(e) => setFiltroCarpeta(e.target.value)}
            disabled={cargandoCarpetas && !!proyectoSeleccionado}
          >
            <option value="ALL">Todas las carpetas</option>
            
            {!proyectoSeleccionado && [
              'Matriz de cumplimiento SH',
              'QR WEEKLY',
              'PIRAMIDE SH',
              'Campañas',
              'KPI',
              'Platicas de seguridad'
            ].map(nombre => (
              <option key={`STATIC_${nombre}`} value={`STATIC_${nombre}`}>{nombre}</option>
            ))}

            {proyectoSeleccionado && carpetasDrive.length === 0 && !cargandoCarpetas && (
              <option value="ALL" disabled>Carpeta del proyecto</option>
            )}
            {proyectoSeleccionado && cargandoCarpetas && (
              <option value="ALL" disabled>Cargando carpetas...</option>
            )}
            {proyectoSeleccionado && carpetasDrive.map(carpeta => (
              <option key={carpeta.id} value={carpeta.id}>
                {carpeta.isProjectRoot ? `📁 ${carpeta.name} (Raíz)` : carpeta.name}
              </option>
            ))}
          </select>
          <div className="fecha-filter-container">
            <select
              className="fecha-rango-select"
              value={filtroFecha}
              onChange={(e) => handleFiltroFechaChange(e.target.value)}
            >
              <option value="all">Todas las fechas</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
              <option value="3months">Últimos 3 meses</option>
              <option value="6months">Últimos 6 meses</option>
              <option value="year">Último año</option>
              <option value="custom">Personalizado</option>
            </select>
            <div className={`fecha-personalizada ${filtroFecha !== 'custom' ? 'disabled' : ''}`}>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                disabled={filtroFecha !== 'custom'}
                aria-label="Fecha desde"
              />
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                disabled={filtroFecha !== 'custom'}
                aria-label="Fecha hasta"
              />
            </div>
            {errorFecha && (
              <span className="error-fecha">{errorFecha}</span>
            )}
          </div>
        </div>
        <div className="toolbar-derecha">
          <div className="vista-toggle">
            <button
              className={vistaTipo === 'grid' ? 'activo' : ''}
              onClick={() => setVistaTipo('grid')}
            >
              <FiGrid />
            </button>
            <button
              className={vistaTipo === 'list' ? 'activo' : ''}
              onClick={() => setVistaTipo('list')}
            >
              <FiList />
            </button>
          </div>
        </div>
      </div>

      {currentUser?.role === 'SUPERADMIN' && !proyectoSeleccionado && (
        <div className="warning-banner">
          <FiAlertCircle />
          <span>Selecciona un proyecto para poder subir archivos</span>
        </div>
      )}

      {currentUser?.role === 'SUPERADMIN' && (
      <div className="zona-subida" {...getRootProps()}>
        <input {...getInputProps()} />
        <div className={`zona-contenido ${isDragActive ? 'arrastrando' : ''} ${!proyectoSeleccionado ? 'zona-deshabilitada' : ''}`}>
          <FiUpload size={48} />
          {subiendo ? (
            <p>Subiendo archivos...</p>
          ) : !proyectoSeleccionado ? (
            <>
              <p>Selecciona un proyecto primero</p>
              <p className="zona-ayuda">Debes elegir un proyecto antes de subir archivos</p>
            </>
          ) : isDragActive ? (
            <p>Suelta los archivos aquí...</p>
          ) : (
            <>
              <p>Arrastra archivos aquí o haz clic para seleccionar</p>
              <p className="zona-ayuda">Los archivos se subirán automáticamente a Google Drive</p>
            </>
          )}
        </div>
      </div>
      )}

      {filtroCarpeta.startsWith('STATIC_') && archivosFiltrados.length > 0 && !cargando && !error && (
        <div style={{ padding: '0 2rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', background: 'var(--primary-color, #3b82f6)', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={async () => {
              const zipName = `${filtroCarpeta.replace('STATIC_', '')}.zip`;
              const idDescarga = toast.loading(`Preparando ZIP con ${archivosFiltrados.length} archivos...`);
              
              try {
                await downloadFilesAsZip(archivosFiltrados, zipName);
                toast.success('ZIP descargado correctamente', { id: idDescarga });
              } catch (error) {
                toast.error('Error al generar el ZIP: ' + error.message, { id: idDescarga });
              }
            }}
          >
            <FiDownload /> Descargar como ZIP ({archivosFiltrados.length})
          </button>
        </div>
      )}

      {cargando ? (
        <div className="cargando">
          <div className="spinner"></div>
          <p>Cargando archivos...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <FiFile size={48} />
          <p>{error}</p>
          <button onClick={cargarArchivos} className="btn-reintentar">
            Reintentar
          </button>
        </div>
      ) : (
        <div className={`archivos-contenedor ${vistaTipo}`}>
          {archivosFiltrados.length === 0 ? (
            <div className="sin-archivos">
              <FiFile size={48} />
              <p>No se encontraron archivos</p>
            </div>
          ) : (
            archivosMostrados.map(archivo => (
              <div key={archivo.id} className="archivo-item">
                <div className="archivo-thumbnail" onClick={() => handleDownloadArchivo(archivo)}>
                  {obtenerThumbnail(archivo)}
                </div>
                <div className="archivo-info">
                  <h4 className="archivo-nombre">{archivo.name}</h4>
                  <div className="archivo-meta">
                    <span>{formatearTamano(archivo.file_size)}</span>
                    <span>•</span>
                    <span>{archivo.uploaded_by?.username || 'Usuario'}</span>
                    {archivo.project_info?.name && (
                      <>
                        <span>•</span>
                        <span>{archivo.project_info.name}</span>
                      </>
                    )}
                  </div>
                  {obtenerEstadoDrive(archivo.upload_status)}
                </div>
                <div className="archivo-acciones">
                  {archivo.drive_file_url && (
                    <button
                      className="btn-icono"
                      title="Ver en Drive"
                      onClick={() => window.open(archivo.drive_file_url, '_blank')}
                    >
                      <FiExternalLink />
                    </button>
                  )}
                  <button
                    className="btn-icono"
                    title=""
                    onClick={() => handleDownloadArchivo(archivo)}
                  >
                    <FiDownload />
                  </button>
                  {currentUser?.role === 'SUPERADMIN' && (
                    <button
                      className="btn-icono btn-peligro"
                      title="Eliminar"
                      onClick={() => handleDeleteArchivo(archivo.id)}
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      {!cargando && !error && archivosFiltrados.length > visibleCount && (
        <div style={{ textAlign: 'center', padding: '2rem 0', width: '100%' }}>
          <button 
            style={{ padding: '0.75rem 2rem', background: '#f97316', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            onClick={() => setVisibleCount(prev => prev + 50)}
          >
            Cargar más archivos ({archivosFiltrados.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  );
};

export default ArchivosPage;
