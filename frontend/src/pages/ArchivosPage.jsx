import { useState, useEffect } from 'react';
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
import toast from 'react-hot-toast';
import { FILTER_TYPES } from '../constants/folderTypes';
import './ArchivosPage.scss';

const ArchivosPage = () => {
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

  const cargarCarpetasDrive = async (projectId) => {
    if (!projectId) {
      setCarpetasDrive([]);
      setFiltroCarpeta('ALL');
      return;
    }

    try {
      setCargandoCarpetas(true);
      const folders = await getFoldersForProject(projectId);
      setCarpetasDrive(folders);
      // Reset folder filter to "ALL" when project changes
      setFiltroCarpeta('ALL');
    } catch (error) {
      console.error('Error cargando carpetas:', error);
      
      // Handle specific error types
      if (error.statusCode === 403) {
        // Permission error - user doesn't have access to this project
        toast.error('No tiene permisos para ver las carpetas de este proyecto');
        setCarpetasDrive([]);
      } else if (error.type === 'refresh_error') {
        toast.error('Error de autenticación con Google Drive. Contacte al administrador.');
        setCarpetasDrive([]);
      } else if (error.type === 'permission_error') {
        toast.error('Sin permisos para acceder a Google Drive. Contacte al administrador.');
        setCarpetasDrive([]);
      } else {
        // For other errors, silently fail - show static folders if Drive folders can't be loaded
        setCarpetasDrive([]);
      }
    } finally {
      setCargandoCarpetas(false);
    }
  };

  const cargarArchivos = async () => {
    try {
      setCargando(true);
      setError(null);
      
      // Build query params based on folder_type mapping
      const params = {};
      
      // Apply type filter if selected (IMAGENES, DOCUMENTOS, etc.)
      // This is separate from the folder filter
      if (filtroTipo !== FILTER_TYPES.ALL) {
        params.folder_type = filtroTipo;
      }
      
      // Note: We don't send folder filter to backend when using dynamic folders
      // Instead, we filter client-side by drive_parent_folder_name
      
      // Filter by selected project
      if (proyectoSeleccionado) {
        params.project = proyectoSeleccionado;
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
  };

  useEffect(() => {
    cargarProyectos();
  }, []);

  useEffect(() => {
    cargarCarpetasDrive(proyectoSeleccionado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoSeleccionado]);

  useEffect(() => {
    cargarArchivos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, filtroCarpeta, proyectoSeleccionado]);

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
        // Upload each file
        const promises = archivosAceptados.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          
          // Determine folder_type for upload
          // Use the type filter if it's not 'ALL', otherwise use default DOCUMENTS
          // Note: filtroCarpeta contains Google Drive folder IDs, not folder_type
          const selectedFolderType = filtroTipo !== FILTER_TYPES.ALL 
            ? filtroTipo 
            : FILTER_TYPES.DOCUMENTS;
          formData.append('folder_type', selectedFolderType);
          
          // Add project ID (required)
          formData.append('project', proyectoSeleccionado);
          
          return uploadDocument(formData);
        });
        
        await Promise.all(promises);
        
        toast.success(`${archivosAceptados.length} archivo(s) subido(s) correctamente`);
        
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
      // If file has a direct URL, open it
      if (archivo.file_url) {
        window.open(archivo.file_url, '_blank');
      } else {
        toast.error('URL de archivo no disponible');
      }
    } catch (error) {
      console.error('Error descargando archivo:', error);
      toast.error('Error al descargar el archivo');
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

  const archivosFiltrados = archivos.filter(archivo => {
    const nombreArchivo = archivo.name || '';
    const proyectoNombre = archivo.project?.name || '';
    
    const coincideBusqueda = nombreArchivo.toLowerCase().includes(busqueda.toLowerCase()) ||
                             proyectoNombre.toLowerCase().includes(busqueda.toLowerCase());
    
    // Filter by folder_type which matches backend model
    let coincideTipo = true;
    if (filtroTipo !== FILTER_TYPES.ALL) {
      // Match folder_type from backend
      coincideTipo = archivo.folder_type === filtroTipo;
    }
    
    // Filter by selected Drive folder
    let coincideCarpeta = true;
    if (filtroCarpeta && filtroCarpeta !== 'ALL' && carpetasDrive.length > 0) {
      // Find the selected folder
      const carpetaSeleccionada = carpetasDrive.find(c => c.id === filtroCarpeta);
      if (carpetaSeleccionada) {
        // Filter files that are in this folder using the drive_parent_folder_name
        // The parent folder name is either:
        // - Task title (if file has a task)
        // - User name (if file has no task - user folder is directly under project)
        coincideCarpeta = archivo.drive_parent_folder_name === carpetaSeleccionada.name;
      }
    }
    
    return coincideBusqueda && coincideTipo && coincideCarpeta;
  });

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
              onChange={(e) => setProyectoSeleccionado(e.target.value || null)}
              className="proyecto-select"
            >
              <option value="">Seleccionar proyecto...</option>
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
            disabled={cargandoCarpetas || !proyectoSeleccionado}
          >
            {carpetasDrive.length > 1 && (
              <option value="ALL">Todas las carpetas</option>
            )}
            {carpetasDrive.length === 0 && !proyectoSeleccionado && (
              <option value="ALL">Selecciona un proyecto primero</option>
            )}
            {carpetasDrive.length === 0 && proyectoSeleccionado && !cargandoCarpetas && (
              <option value="ALL">Carpeta del proyecto</option>
            )}
            {cargandoCarpetas && (
              <option value="ALL">Cargando carpetas...</option>
            )}
            {carpetasDrive.map(carpeta => (
              <option key={carpeta.id} value={carpeta.id}>
                {carpeta.isProjectRoot ? `📁 ${carpeta.name} (Raíz)` : carpeta.name}
              </option>
            ))}
          </select>
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

      {!proyectoSeleccionado && (
        <div className="warning-banner">
          <FiAlertCircle />
          <span>Selecciona un proyecto para poder subir archivos</span>
        </div>
      )}

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
            archivosFiltrados.map(archivo => (
              <div key={archivo.id} className="archivo-item">
                <div className="archivo-icono">
                  <span className="icono-tipo">{obtenerIconoArchivo(archivo.file_type)}</span>
                </div>
                <div className="archivo-info">
                  <h4 className="archivo-nombre">{archivo.name}</h4>
                  <div className="archivo-meta">
                    <span>{formatearTamano(archivo.file_size)}</span>
                    <span>•</span>
                    <span>{archivo.uploaded_by?.username || 'Usuario'}</span>
                    {archivo.project?.name && (
                      <>
                        <span>•</span>
                        <span>{archivo.project.name}</span>
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
                    title="Descargar"
                    onClick={() => handleDownloadArchivo(archivo)}
                  >
                    <FiDownload />
                  </button>
                  <button 
                    className="btn-icono btn-peligro" 
                    title="Eliminar"
                    onClick={() => handleDeleteArchivo(archivo.id)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ArchivosPage;
