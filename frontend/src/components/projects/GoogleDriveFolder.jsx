import React, { useEffect, useState } from 'react';
import { getProjectDriveFolder } from '../../services/projectService';
import { FiFolder, FiDownload, FiExternalLink, FiFile, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FOLDER_TYPES } from '../../constants/folderTypes';
import './GoogleDriveFolder.scss';

// Constants for Google Drive file ID validation
const DRIVE_FILE_ID_MIN_LENGTH = 20;
const DRIVE_FILE_ID_MAX_LENGTH = 50;
const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const GoogleDriveFolder = ({ projectId, userRole }) => {
  const [folderData, setFolderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [folderFilter, setFolderFilter] = useState(FOLDER_TYPES.ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Validate Google Drive file ID format (alphanumeric and some special chars)
  const isValidDriveFileId = (fileId) => {
    if (!fileId || typeof fileId !== 'string') return false;
    // Google Drive file IDs are typically 28-33 characters, alphanumeric with hyphens and underscores
    return (
      DRIVE_FILE_ID_PATTERN.test(fileId) &&
      fileId.length >= DRIVE_FILE_ID_MIN_LENGTH &&
      fileId.length <= DRIVE_FILE_ID_MAX_LENGTH
    );
  };

  useEffect(() => {
    const fetchFolder = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const params = {
          page: currentPage,
          page_size: pageSize
        };
        
        if (searchTerm) {
          params.search = searchTerm;
        }
        
        if (folderFilter && folderFilter !== FOLDER_TYPES.ALL) {
          params.folder_type = folderFilter;
        }
        
        const data = await getProjectDriveFolder(projectId, params);
        setFolderData(data);
      } catch (err) {
        console.error('Error fetching drive folder:', err);
        setError('No se pudo cargar la carpeta de Google Drive');
      } finally {
        setLoading(false);
      }
    };

    fetchFolder();
  }, [projectId, currentPage, pageSize, searchTerm, folderFilter]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return <FiFile />;
    
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('video')) return '🎥';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
    if (fileType.includes('zip') || fileType.includes('compressed')) return '📦';
    
    return <FiFile />;
  };

  if (loading) {
    return (
      <div className="drive-folder-loading">
        <div className="loading-spinner"></div>
        <p>Cargando archivos de Google Drive...</p>
      </div>
    );
  }

  if (error || !folderData) {
    return (
      <div className="drive-folder-error">
        <p>{error || 'No hay carpeta de Drive disponible'}</p>
      </div>
    );
  }

  const { project_name, total_documents, documents, page, total_pages, has_next, has_previous } = folderData;

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleFolderFilterChange = (e) => {
    setFolderFilter(e.target.value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleNextPage = () => {
    if (has_next) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (has_previous) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getEmptyMessage = () => {
    if (searchTerm || folderFilter) {
      return 'No hay archivos que coincidan con los filtros en la carpeta de Google Drive de este proyecto.';
    }
    return 'No hay archivos en la carpeta de Google Drive de este proyecto.';
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="drive-folder-empty">
        <FiFolder size={48} />
        <p>{getEmptyMessage()}</p>
      </div>
    );
  }

  return (
    <div className="google-drive-folder">
      <div className="folder-header">
        <h3>
          <FiFolder /> Carpeta de Google Drive
        </h3>
        <p className="folder-subtitle">
          {project_name} - {total_documents} {total_documents === 1 ? 'archivo' : 'archivos'}
        </p>
      </div>

      <div className="folder-filters">
        <div className="search-container">
          <FiSearch />
          <input
            type="text"
            placeholder="Buscar archivos por nombre..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        <select 
          className="folder-type-filter"
          value={folderFilter}
          onChange={handleFolderFilterChange}
        >
          <option value={FOLDER_TYPES.ALL}>Todas las carpetas</option>
          <option value={FOLDER_TYPES.OPERATIVO}>Operativo</option>
          <option value={FOLDER_TYPES.ADMINISTRATIVO}>Administrativo</option>
          <option value={FOLDER_TYPES.DOCUMENTOS}>Documentos</option>
          <option value={FOLDER_TYPES.IMAGENES}>Imágenes</option>
          <option value={FOLDER_TYPES.VIDEOS}>Videos</option>
          <option value={FOLDER_TYPES.ARCHIVOS}>Archivos</option>
          <option value={FOLDER_TYPES.TASK_SUBMISSION}>Entrega de Tarea</option>
          <option value={FOLDER_TYPES.OTROS}>Otros</option>
        </select>
      </div>

      <div className="documents-list">
        {documents.map((doc) => (
          <div key={doc.id} className="document-item">
            <div className="document-icon">
              {getFileIcon(doc.file_type)}
            </div>
            
            <div className="document-info">
              <h4 className="document-name">{doc.name}</h4>
              <div className="document-meta">
                <span className="document-size">{formatFileSize(doc.file_size)}</span>
                <span className="document-separator">•</span>
                <span className="document-type">{doc.folder_type}</span>
                <span className="document-separator">•</span>
                <span className="document-date">
                  {doc.created_at ? format(parseISO(doc.created_at), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                </span>
              </div>
              <p className="document-uploader">
                Subido por: {doc.uploaded_by?.name || 'Desconocido'}
              </p>
            </div>

            <div className="document-actions">
              {doc.drive_file_url && (
                <>
                  <a
                    href={doc.drive_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-action btn-view"
                    title="Ver en Drive"
                  >
                    <FiExternalLink />
                    <span>Ver</span>
                  </a>
                  {/* Google Drive download URL uses the file ID to create a direct download link */}
                  {/* Only create download link if file ID is valid */}
                  {doc.drive_file_id && isValidDriveFileId(doc.drive_file_id) && (
                    <a
                      href={`https://drive.google.com/uc?export=download&id=${encodeURIComponent(doc.drive_file_id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-action btn-download"
                      title="Descargar archivo"
                    >
                      <FiDownload />
                      <span>Descargar</span>
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {total_pages > 1 && (
        <div className="pagination-controls">
          <button 
            onClick={handlePreviousPage} 
            disabled={!has_previous}
            className="pagination-btn"
          >
            <FiChevronLeft /> Anterior
          </button>
          <span className="pagination-info">
            Página {page} de {total_pages}
          </span>
          <button 
            onClick={handleNextPage} 
            disabled={!has_next}
            className="pagination-btn"
          >
            Siguiente <FiChevronRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveFolder;
