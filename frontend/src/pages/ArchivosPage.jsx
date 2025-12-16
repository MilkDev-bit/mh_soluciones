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
import './ArchivosPage.scss';

const ArchivosPage = () => {
  const { user } = useContext(AuthContext);
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaTipo, setVistaTipo] = useState('grid'); // 'grid' o 'list'
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [carpetaActual, setCarpetaActual] = useState('raiz');
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargarArchivos();
  }, [carpetaActual, filtroTipo]);

  const cargarArchivos = async () => {
    try {
      setCargando(true);
      // TODO: Implementar llamada a la API
      // const response = await fetch(`/api/archivos/?carpeta=${carpetaActual}&tipo=${filtroTipo}`);
      // const data = await response.json();
      
      // Datos de ejemplo
      const archivosEjemplo = [
        {
          id: 1,
          nombre: 'Diseño_UI_Dashboard.pdf',
          tipo: 'application/pdf',
          tamano: 2457600,
          fecha: new Date(Date.now() - 86400000),
          subidoPor: 'Juan Pérez',
          estadoDrive: 'COMPLETE',
          driveUrl: 'https://drive.google.com/file/ejemplo1',
          proyecto: 'Sistema de Gestión'
        },
        {
          id: 2,
          nombre: 'Presentacion_Cliente.pptx',
          tipo: 'application/vnd.ms-powerpoint',
          tamano: 5242880,
          fecha: new Date(Date.now() - 172800000),
          subidoPor: 'María González',
          estadoDrive: 'UPLOADING',
          driveUrl: null,
          proyecto: 'Marketing Digital'
        },
        {
          id: 3,
          nombre: 'Imagen_Logo.png',
          tipo: 'image/png',
          tamano: 102400,
          fecha: new Date(Date.now() - 259200000),
          subidoPor: 'Carlos Ruiz',
          estadoDrive: 'COMPLETE',
          driveUrl: 'https://drive.google.com/file/ejemplo3',
          proyecto: 'Branding'
        }
      ];
      
      setArchivos(archivosEjemplo);
    } catch (error) {
      console.error('Error cargando archivos:', error);
    } finally {
      setCargando(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (archivosAceptados) => {
      setSubiendo(true);
      try {
        // TODO: Implementar subida de archivos
        console.log('Archivos a subir:', archivosAceptados);
        
        // Simular subida
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Recargar archivos después de la subida
        await cargarArchivos();
      } catch (error) {
        console.error('Error subiendo archivos:', error);
      } finally {
        setSubiendo(false);
      }
    }
  });

  const formatearTamano = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const tamaños = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + tamaños[i];
  };

  const obtenerIconoArchivo = (tipo) => {
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
      default:
        return <span className="estado-badge pendiente"><FiClock /> Pendiente</span>;
    }
  };

  const archivosFiltrados = archivos.filter(archivo => {
    const coincideBusqueda = archivo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                             archivo.proyecto.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTipo = filtroTipo === 'TODOS' || archivo.tipo.startsWith(filtroTipo.toLowerCase());
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
            <option value="TODOS">Todos los tipos</option>
            <option value="image">Imágenes</option>
            <option value="application/pdf">PDF</option>
            <option value="application">Documentos</option>
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
                  <span className="icono-tipo">{obtenerIconoArchivo(archivo.tipo)}</span>
                </div>
                <div className="archivo-info">
                  <h4 className="archivo-nombre">{archivo.nombre}</h4>
                  <div className="archivo-meta">
                    <span>{formatearTamano(archivo.tamano)}</span>
                    <span>•</span>
                    <span>{archivo.subidoPor}</span>
                    <span>•</span>
                    <span>{archivo.proyecto}</span>
                  </div>
                  {obtenerEstadoDrive(archivo.estadoDrive)}
                </div>
                <div className="archivo-acciones">
                  {archivo.driveUrl && (
                    <button 
                      className="btn-icono"
                      title="Ver en Drive"
                      onClick={() => window.open(archivo.driveUrl, '_blank')}
                    >
                      <FiExternalLink />
                    </button>
                  )}
                  <button className="btn-icono" title="Descargar">
                    <FiDownload />
                  </button>
                  <button className="btn-icono btn-peligro" title="Eliminar">
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
