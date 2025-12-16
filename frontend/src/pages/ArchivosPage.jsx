import React, { useState, useEffect, useContext } from 'react';
import { 
  FiFile, 
  FiFolder,
  FiUpload,
  FiDownload,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiGrid,
  FiList,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiExternalLink
} from 'react-icons/fi';
import { AuthContext } from '../contexts/AuthContext';
import { useDropzone } from 'react-dropzone';
import { getAllDocuments, uploadDocument, deleteDocument } from '../services/documentService';
import toast from 'react-hot-toast';
import './ArchivosPage.scss';

// Filter type constants
const FILTER_TYPES = {
  ALL: 'TODOS',
  IMAGES: 'IMAGENES',
  DOCUMENTS: 'DOCUMENTOS',
  VIDEOS: 'VIDEOS',
  FILES: 'ARCHIVOS'
};

const ArchivosPage = () => {
  const { user } = useContext(AuthContext);
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaTipo, setVistaTipo] = useState('grid'); // 'grid' o 'list'
  const [filtroTipo, setFiltroTipo] = useState(FILTER_TYPES.ALL);
  const [busqueda, setBusqueda] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarArchivos();
  }, [filtroTipo]);

  const cargarArchivos = async () => {
    try {
      setCargando(true);
      setError(null);
      
      // Build query params based on folder_type mapping
      const params = {};
      if (filtroTipo !== FILTER_TYPES.ALL) {
        // Use folder_type from backend model instead of file_type
        params.folder_type = filtroTipo;
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (archivosAceptados) => {
      if (archivosAceptados.length === 0) return;
      
      setSubiendo(true);
      try {
        // Upload each file
        const promises = archivosAceptados.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          // Use folder_type matching the backend model choices
          formData.append('folder_type', filtroTipo !== FILTER_TYPES.ALL ? filtroTipo : FILTER_TYPES.DOCUMENTS);
          
          return uploadDocument(formData);
        });
        
        await Promise.all(promises);
        
        toast.success(`${archivosAceptados.length} archivo(s) subido(s) correctamente`);
        
        // Recargar archivos después de la subida
        await cargarArchivos();
      } catch (error) {
        console.error('Error subiendo archivos:', error);
        toast.error('Error al subir algunos archivos');
      } finally {
        setSubiendo(false);
      }
    },
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
    
    return coincideBusqueda && coincideTipo;
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

      <div className="zona-subida" {...getRootProps()}>
        <input {...getInputProps()} />
        <div className={`zona-contenido ${isDragActive ? 'arrastrando' : ''}`}>
          <FiUpload size={48} />
          {subiendo ? (
            <p>Subiendo archivos...</p>
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
