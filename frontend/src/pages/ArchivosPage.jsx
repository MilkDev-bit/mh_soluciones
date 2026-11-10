import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  FiFile, FiUpload, FiDownload, FiTrash2, FiSearch, FiGrid, FiList, FiCheckCircle, FiClock,
  FiAlertCircle, FiExternalLink, FiFolder, FiChevronRight, FiArrowLeft, FiUser, FiBriefcase, FiX,
} from 'react-icons/fi';
import { useDropzone } from 'react-dropzone';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../services/api';
import { uploadDocument, deleteDocument, getFoldersForProject } from '../services/documentService';
import { handleViewFile } from '../utils/fileUtils';
import toast from 'react-hot-toast';
import { FILTER_TYPES } from '../constants/folderTypes';
import PdfThumbnail from '../components/common/PdfThumbnail';
import './ArchivosPage.scss';

/**
 * Centro de Archivos.
 *
 * Antes: descargaba hasta 1000 documentos de golpe y filtraba en el navegador
 * (con más de 1000, los demás no aparecían); las carpetas salían de la API de
 * Google Drive en cada clic y solo para un proyecto; el ZIP solo existía para
 * 6 carpetas fijas y omitía los archivos guardados solo en Drive.
 *
 * Ahora:
 *  - Navegación por carpetas: Proyectos › Carpeta (tarea) › Persona, con
 *    número de archivos, tamaño y última subida. Se calcula en el servidor
 *    sin consultar Drive (/documents/folder-summary/).
 *  - Búsqueda, tipo y fechas se aplican en el servidor, con paginación real.
 *  - "Descargar carpeta" baja TODO lo que estás viendo (con los filtros) como
 *    un ZIP organizado en subcarpetas, generado en streaming por el servidor.
 */

const PAGE_SIZE = 60;

const DATE_RANGES = {
  week: 7, month: 30, '3months': 90, '6months': 182, year: 365,
};

const localISO = (date) => format(date, 'yyyy-MM-dd');

const formatearTamano = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${units[i]}`;
};

const formatearFecha = (iso) => {
  if (!iso) return '';
  try { return format(parseISO(iso), 'dd MMM yyyy', { locale: es }); } catch { return ''; }
};

const iconoArchivo = (tipo = '') => {
  if (tipo.startsWith('image/')) return '🖼️';
  if (tipo.includes('pdf')) return '📄';
  if (tipo.includes('word')) return '📝';
  if (tipo.includes('excel') || tipo.includes('spreadsheet')) return '📊';
  if (tipo.includes('powerpoint') || tipo.includes('presentation')) return '📊';
  if (tipo.includes('zip') || tipo.includes('rar')) return '📦';
  if (tipo.startsWith('video/')) return '🎬';
  return '📁';
};

const EstadoDrive = ({ estado }) => {
  switch (estado) {
    case 'COMPLETE': return <span className="estado-badge completo"><FiCheckCircle /> Sincronizado</span>;
    case 'UPLOADING': return <span className="estado-badge subiendo"><FiClock /> Subiendo...</span>;
    case 'FAILED': return <span className="estado-badge fallido"><FiAlertCircle /> Falló</span>;
    default: return <span className="estado-badge pendiente"><FiClock /> Pendiente</span>;
  }
};

const ArchivosPage = () => {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.role === 'SUPERADMIN';

  // Ruta de navegación: proyecto › carpeta › persona
  const [ruta, setRuta] = useState({ project: null, folder: null, person: null });

  // Filtros (se aplican en el servidor)
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [filtroTipo, setFiltroTipo] = useState(FILTER_TYPES.ALL);
  const [filtroFecha, setFiltroFecha] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [vistaTipo, setVistaTipo] = useState('grid');
  const [carpetas, setCarpetas] = useState({ level: 'projects', items: [] });
  const [cargandoCarpetas, setCargandoCarpetas] = useState(true);
  const [archivos, setArchivos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);

  // Subida (solo SUPERADMIN): carpeta de Drive destino opcional
  const [subiendo, setSubiendo] = useState(false);
  const [carpetasDrive, setCarpetasDrive] = useState([]);
  const [carpetaDriveDestino, setCarpetaDriveDestino] = useState('');

  // Búsqueda con debounce de 350 ms
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const errorFecha = filtroFecha === 'custom' && fechaDesde && fechaHasta && fechaDesde > fechaHasta
    ? 'La fecha "desde" no puede ser posterior a "hasta"'
    : '';

  /** Parámetros comunes a carpetas, archivos y ZIP. */
  const buildParams = useCallback(() => {
    const params = {};
    if (ruta.project) params.project = ruta.project.id;
    if (ruta.folder) params.folder = ruta.folder;
    if (ruta.person) params.uploaded_by = ruta.person.id;
    if (busquedaAplicada) params.search = busquedaAplicada;
    if (filtroTipo !== FILTER_TYPES.ALL) params.folder_type = filtroTipo;
    if (filtroFecha === 'custom') {
      if (!errorFecha) {
        if (fechaDesde) params.date_from = fechaDesde;
        if (fechaHasta) params.date_to = fechaHasta;
      }
    } else if (DATE_RANGES[filtroFecha]) {
      const d = new Date();
      d.setDate(d.getDate() - DATE_RANGES[filtroFecha]);
      params.date_from = localISO(d);
    }
    return params;
  }, [ruta, busquedaAplicada, filtroTipo, filtroFecha, fechaDesde, fechaHasta, errorFecha]);

  // Carpetas del nivel actual (no aplica al nivel de persona: ahí solo hay archivos)
  useEffect(() => {
    if (ruta.person) {
      setCarpetas({ level: 'files', items: [] });
      setCargandoCarpetas(false);
      return undefined;
    }
    const controller = new AbortController();
    setCargandoCarpetas(true);
    api.get('/documents/folder-summary/', { params: buildParams(), signal: controller.signal })
      .then(({ data }) => setCarpetas(data))
      .catch((err) => {
        if (err.name !== 'CanceledError') toast.error('No se pudieron cargar las carpetas');
      })
      .finally(() => setCargandoCarpetas(false));
    return () => controller.abort();
  }, [buildParams, ruta.person]);

  // Archivos: primera página cada vez que cambian ruta o filtros
  const archivosRequest = useRef(null);
  const cargarArchivos = useCallback(async (page = 1) => {
    archivosRequest.current?.abort();
    const controller = new AbortController();
    archivosRequest.current = controller;
    page === 1 ? setCargando(true) : setCargandoMas(true);
    setError(null);
    try {
      const { data } = await api.get('/documents/', {
        params: { ...buildParams(), page, page_size: PAGE_SIZE },
        signal: controller.signal,
      });
      const results = Array.isArray(data) ? data : (data.results || []);
      setArchivos((prev) => (page === 1 ? results : [...prev, ...results]));
      setTotal(Array.isArray(data) ? results.length : (data.count ?? results.length));
      setHayMas(Boolean(data.next));
      setPagina(page);
    } catch (err) {
      if (err.name === 'CanceledError') return;
      setError('No se pudieron cargar los archivos. Intenta de nuevo.');
    } finally {
      if (archivosRequest.current === controller) {
        setCargando(false);
        setCargandoMas(false);
      }
    }
  }, [buildParams]);

  useEffect(() => { cargarArchivos(1); }, [cargarArchivos]);

  // Carpetas de Drive para elegir destino al subir (solo con proyecto)
  useEffect(() => {
    setCarpetaDriveDestino('');
    if (!isSuperadmin || !ruta.project) { setCarpetasDrive([]); return; }
    getFoldersForProject(ruta.project.id)
      .then((folders) => setCarpetasDrive((folders || []).filter((f) => !f.isProjectRoot)))
      .catch(() => setCarpetasDrive([]));
  }, [isSuperadmin, ruta.project]);

  // --- Navegación ---------------------------------------------------------
  const entrar = (item) => {
    if (item.kind === 'project' && item.id == null) {
      toast('Estos archivos no pertenecen a ningún proyecto; búscalos por nombre.');
      return;
    }
    if (item.kind === 'project') setRuta({ project: { id: item.id, name: item.name }, folder: null, person: null });
    else if (item.kind === 'folder') setRuta((r) => ({ ...r, folder: item.name, person: null }));
    else if (item.kind === 'person') setRuta((r) => ({ ...r, person: { id: item.id, name: item.name } }));
  };

  const irA = (nivel) => {
    if (nivel === 'root') setRuta({ project: null, folder: null, person: null });
    if (nivel === 'project') setRuta((r) => ({ ...r, folder: null, person: null }));
    if (nivel === 'folder') setRuta((r) => ({ ...r, person: null }));
  };

  const atras = () => {
    if (ruta.person) irA('folder');
    else if (ruta.folder) irA('project');
    else irA('root');
  };

  const nombreNivel = ruta.person?.name || ruta.folder || ruta.project?.name || 'Todos los proyectos';
  const hayFiltros = Boolean(busquedaAplicada || filtroTipo !== FILTER_TYPES.ALL || filtroFecha !== 'all');

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroTipo(FILTER_TYPES.ALL);
    setFiltroFecha('all');
    setFechaDesde('');
    setFechaHasta('');
  };

  // --- Descarga de carpeta completa --------------------------------------
  const descargarZip = async () => {
    if (!total) return;
    if (currentUser?.role === 'CLIENT' && !ruta.project) {
      toast.error('Entra a un proyecto para descargarlo.');
      return;
    }
    if (total > 300 && !window.confirm(`Vas a descargar ${total} archivos en un ZIP. ¿Continuar?`)) return;
    setDescargando(true);
    try {
      // Petición ligera antes de descargar: si la sesión expiró, el
      // interceptor la renueva y la descarga no termina en un error 401.
      await api.get('/documents/', { params: { ...buildParams(), page_size: 1 } });
      const params = new URLSearchParams({ ...buildParams(), zip_name: nombreNivel });
      const base = (api.defaults.baseURL || '/api/v1').replace(/\/$/, '');
      const link = document.createElement('a');
      link.href = `${base}/documents/download-zip/?${params.toString()}`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('La descarga del ZIP comenzó. Los archivos grandes pueden tardar unos minutos.');
    } catch {
      toast.error('No se pudo iniciar la descarga.');
    } finally {
      setTimeout(() => setDescargando(false), 1500);
    }
  };

  // --- Subida ---------------------------------------------------------------
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled: !ruta.project || subiendo,
    maxSize: 900 * 1024 * 1024,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'text/plain': ['.txt'],
    },
    onDrop: async (files) => {
      if (!files.length || !ruta.project) return;
      setSubiendo(true);
      try {
        await Promise.all(files.map((file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder_type', filtroTipo !== FILTER_TYPES.ALL ? filtroTipo : FILTER_TYPES.DOCUMENTS);
          formData.append('project', ruta.project.id);
          if (carpetaDriveDestino) formData.append('target_folder_id', carpetaDriveDestino);
          return uploadDocument(formData);
        }));
        const destino = carpetasDrive.find((c) => c.id === carpetaDriveDestino)?.name;
        toast.success(`${files.length} archivo(s) subido(s)${destino ? ` a "${destino}"` : ''}`);
        cargarArchivos(1);
      } catch (err) {
        const porTipo = {
          refresh_error: 'Las credenciales de Google Drive expiraron. Contacta al administrador.',
          permission_error: 'Sin permisos para acceder a Google Drive. Contacta al administrador.',
          folder_error: 'No se pudo acceder a la carpeta del proyecto en Drive.',
        };
        toast.error(porTipo[err.type] || err.message || 'No se pudo subir el archivo.');
      } finally {
        setSubiendo(false);
      }
    },
  });

  const eliminar = async (archivo) => {
    if (!window.confirm(`¿Eliminar "${archivo.name}"?`)) return;
    try {
      await deleteDocument(archivo.id);
      toast.success('Archivo eliminado');
      setArchivos((prev) => prev.filter((a) => a.id !== archivo.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch {
      toast.error('No se pudo eliminar el archivo');
    }
  };

  const abrir = async (archivo) => {
    try { await handleViewFile(archivo); } catch { toast.error('No se pudo abrir el archivo'); }
  };

  // --- Render -----------------------------------------------------------------
  // Función (no componente): un componente declarado dentro del render se
  // vuelve a montar en cada cambio de estado y volvería a descargar los PDFs.
  const renderThumbnail = (archivo) => {
    const tipo = archivo.file_type || '';
    const url = archivo.file_url || '';
    // Miniaturas solo en vista de cuadrícula; en lista basta el ícono
    if (vistaTipo === 'grid' && url && tipo.startsWith('image/')) {
      return <img src={url} alt="" loading="lazy" decoding="async" className="archivo-thumbnail-img" />;
    }
    if (vistaTipo === 'grid' && url && tipo.includes('pdf')) {
      return <PdfThumbnail url={url} fileName={archivo.name} fallbackIcon={iconoArchivo(tipo)} />;
    }
    return <span className="icono-tipo-grande">{iconoArchivo(tipo)}</span>;
  };

  const iconoCarpeta = { project: FiBriefcase, folder: FiFolder, person: FiUser };

  return (
    <div className="archivos-page">
      <div className="page-header">
        <div>
          <h1>Centro de Archivos</h1>
          <p className="page-subtitle">Navega por proyecto, carpeta y persona; filtra y descarga carpetas completas.</p>
        </div>
      </div>

      <div className="archivos-toolbar">
        <div className="toolbar-izquierda">
          <div className="busqueda-container">
            <FiSearch />
            <input
              type="text"
              placeholder="Buscar por archivo, tarea o persona..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <select className="filtro-tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value={FILTER_TYPES.ALL}>Todos los tipos</option>
            <option value={FILTER_TYPES.IMAGES}>Imágenes</option>
            <option value={FILTER_TYPES.DOCUMENTS}>Documentos</option>
            <option value={FILTER_TYPES.VIDEOS}>Videos</option>
            <option value={FILTER_TYPES.FILES}>Archivos</option>
          </select>
          <div className="fecha-filter-container">
            <select className="fecha-rango-select" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}>
              <option value="all">Todas las fechas</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
              <option value="3months">Últimos 3 meses</option>
              <option value="6months">Últimos 6 meses</option>
              <option value="year">Último año</option>
              <option value="custom">Personalizado</option>
            </select>
            {filtroFecha === 'custom' && (
              <div className="fecha-personalizada">
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} aria-label="Fecha desde" />
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} aria-label="Fecha hasta" />
              </div>
            )}
            {errorFecha && <span className="error-fecha">{errorFecha}</span>}
          </div>
          {hayFiltros && (
            <button className="btn-limpiar-filtros" onClick={limpiarFiltros}><FiX /> Limpiar filtros</button>
          )}
        </div>
        <div className="toolbar-derecha">
          <div className="vista-toggle">
            <button className={vistaTipo === 'grid' ? 'activo' : ''} onClick={() => setVistaTipo('grid')} title="Cuadrícula"><FiGrid /></button>
            <button className={vistaTipo === 'list' ? 'activo' : ''} onClick={() => setVistaTipo('list')} title="Lista"><FiList /></button>
          </div>
        </div>
      </div>

      {/* Ruta + descarga de la carpeta actual */}
      <div className="explorador-barra">
        <div className="carpeta-breadcrumb">
          {ruta.project && (
            <button className="breadcrumb-back" onClick={atras} title="Volver"><FiArrowLeft /></button>
          )}
          <button className="breadcrumb-item" onClick={() => irA('root')}>Todos los proyectos</button>
          {ruta.project && (
            <span className="breadcrumb-trail"><FiChevronRight />
              {ruta.folder ? <button className="breadcrumb-item" onClick={() => irA('project')}>{ruta.project.name}</button>
                : <span className="breadcrumb-current">{ruta.project.name}</span>}
            </span>
          )}
          {ruta.folder && (
            <span className="breadcrumb-trail"><FiChevronRight />
              {ruta.person ? <button className="breadcrumb-item" onClick={() => irA('folder')}>{ruta.folder}</button>
                : <span className="breadcrumb-current">{ruta.folder}</span>}
            </span>
          )}
          {ruta.person && (
            <span className="breadcrumb-trail"><FiChevronRight /><span className="breadcrumb-current">{ruta.person.name}</span></span>
          )}
        </div>
        <button
          className="btn-descargar-carpeta"
          onClick={descargarZip}
          disabled={!total || descargando || Boolean(errorFecha)}
          title={hayFiltros ? 'Descarga solo los archivos que coinciden con los filtros' : 'Descarga todo el contenido de esta carpeta'}
        >
          <FiDownload /> {descargando ? 'Preparando...' : `Descargar ${ruta.project ? 'carpeta' : 'todo'} (${total})`}
        </button>
      </div>

      {isSuperadmin && (
        <div className="zona-subida-wrapper">
          {ruta.project && carpetasDrive.length > 0 && (
            <label className="destino-drive">
              Subir a carpeta de Drive:
              <select value={carpetaDriveDestino} onChange={(e) => setCarpetaDriveDestino(e.target.value)}>
                <option value="">Automática (Año / Proyecto / Usuario)</option>
                {carpetasDrive.map((c) => <option key={c.id} value={c.id}>📁 {c.name}</option>)}
              </select>
            </label>
          )}
          <div className="zona-subida" {...getRootProps()}>
            <input {...getInputProps()} />
            <div className={`zona-contenido ${isDragActive ? 'arrastrando' : ''} ${!ruta.project ? 'zona-deshabilitada' : ''}`}>
              <FiUpload size={36} />
              {subiendo ? <p>Subiendo archivos...</p>
                : !ruta.project ? <p>Entra a un proyecto para subir archivos</p>
                  : isDragActive ? <p>Suelta los archivos aquí...</p>
                    : <p>Arrastra archivos aquí o haz clic para seleccionar</p>}
            </div>
          </div>
        </div>
      )}

      {/* Carpetas del nivel actual */}
      {!ruta.person && (
        <div className="carpetas-seccion">
          {cargandoCarpetas ? (
            <div className="carpetas-cargando">Cargando carpetas...</div>
          ) : carpetas.items.length > 0 && (
            <div className="carpetas-grid">
              {carpetas.items.map((item) => {
                const Icon = iconoCarpeta[item.kind] || FiFolder;
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="carpeta-card"
                    onClick={() => entrar(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && entrar(item)}
                    title={item.name}
                  >
                    <div className="carpeta-card-icono"><Icon /></div>
                    <div className="carpeta-card-info">
                      <span className="carpeta-card-nombre">{item.name}</span>
                      <span className="carpeta-card-meta">
                        {item.count} archivo{item.count === 1 ? '' : 's'} · {formatearTamano(item.size)}
                        {item.last_upload && ` · ${formatearFecha(item.last_upload)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Archivos */}
      <div className="archivos-resumen">
        {cargando ? 'Cargando archivos...' : `${total} archivo${total === 1 ? '' : 's'} en ${nombreNivel}${hayFiltros ? ' (filtrados)' : ''}`}
      </div>

      {error ? (
        <div className="error-container">
          <FiFile size={48} />
          <p>{error}</p>
          <button onClick={() => cargarArchivos(1)} className="btn-reintentar">Reintentar</button>
        </div>
      ) : cargando ? (
        <div className="cargando"><div className="spinner"></div></div>
      ) : archivos.length === 0 ? (
        <div className="sin-archivos">
          <FiFile size={48} />
          <p>{hayFiltros ? 'Ningún archivo coincide con los filtros.' : 'No hay archivos aquí.'}</p>
        </div>
      ) : (
        <div className={`archivos-contenedor ${vistaTipo}`}>
          {archivos.map((archivo) => (
            <div key={archivo.id} className="archivo-item">
              <div className="archivo-thumbnail" onClick={() => abrir(archivo)}>
                {renderThumbnail(archivo)}
              </div>
              <div className="archivo-info">
                <h4 className="archivo-nombre" title={archivo.name}>{archivo.name}</h4>
                <div className="archivo-meta">
                  <span>{formatearTamano(archivo.file_size)}</span>
                  <span>•</span>
                  <span>{archivo.uploaded_by?.full_name || archivo.uploaded_by?.username || 'Usuario'}</span>
                  <span>•</span>
                  <span>{formatearFecha(archivo.created_at)}</span>
                  {!ruta.folder && (archivo.task_name || archivo.drive_parent_folder_name) && (
                    <><span>•</span><span>{archivo.task_name || archivo.drive_parent_folder_name}</span></>
                  )}
                </div>
                <EstadoDrive estado={archivo.upload_status} />
              </div>
              {currentUser?.role !== 'CLIENT' && (
                <div className="archivo-acciones">
                  {archivo.drive_file_url && (
                    <button className="btn-icono" title="Ver en Drive" onClick={() => window.open(archivo.drive_file_url, '_blank', 'noopener')}>
                      <FiExternalLink />
                    </button>
                  )}
                  <button className="btn-icono" title="Abrir / descargar" onClick={() => abrir(archivo)}><FiDownload /></button>
                  {isSuperadmin && (
                    <button className="btn-icono btn-peligro" title="Eliminar" onClick={() => eliminar(archivo)}><FiTrash2 /></button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!cargando && hayMas && (
        <div className="cargar-mas">
          <button onClick={() => cargarArchivos(pagina + 1)} disabled={cargandoMas}>
            {cargandoMas ? 'Cargando...' : `Cargar más (${total - archivos.length} restantes)`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ArchivosPage;
