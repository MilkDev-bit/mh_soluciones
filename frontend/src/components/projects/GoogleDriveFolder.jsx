import React, { useEffect, useState } from 'react';
import { getProjectDriveFolder } from '../../services/projectService';
import { FiFolder, FiDownload, FiExternalLink, FiFile } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import './GoogleDriveFolder.scss';

const GoogleDriveFolder = ({ projectId, userRole }) => {
  const [folderData, setFolderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFolder = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const data = await getProjectDriveFolder(projectId);
        setFolderData(data);
      } catch (err) {
        console.error('Error fetching drive folder:', err);
        setError('No se pudo cargar la carpeta de Google Drive');
      } finally {
        setLoading(false);
      }
    };

    fetchFolder();
  }, [projectId]);

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

  const { project_name, total_documents, documents } = folderData;

  if (!documents || documents.length === 0) {
    return (
      <div className="drive-folder-empty">
        <FiFolder size={48} />
        <p>No hay archivos en la carpeta de Google Drive de este proyecto.</p>
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
                  {doc.drive_file_id && (
                    <a
                      href={`https://drive.google.com/uc?export=download&id=${doc.drive_file_id}`}
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
    </div>
  );
};

export default GoogleDriveFolder;
