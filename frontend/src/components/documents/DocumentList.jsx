import React from 'react';
import { FiDownload, FiTrash2, FiFile } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const DocumentList = ({ documents, onDeleteDocument, canDelete = false }) => {
  const handleDownload = (document) => {
    window.open(document.file, '_blank');
  };

  const handleDelete = (documentId) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este documento?')) {
      onDeleteDocument(documentId);
    }
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="empty-documents">
        <p>No hay documentos para esta tarea.</p>
      </div>
    );
  }

  return (
    <div className="document-list">
      <h4>Documentos adjuntos</h4>
      <div className="documents-container">
        {documents.map((document) => (
          <div key={document.id} className="document-item">
            <div className="document-icon">
              <FiFile />
            </div>
            <div className="document-info">
              <p className="document-name">{document.name}</p>
              <span className="document-date">
                Subido el {format(parseISO(document.created_at), 'dd MMM yyyy', { locale: es })}
              </span>
              <span className="document-size">
                {document.file_size ? `(${Math.round(document.file_size / 1024)} KB)` : ''}
              </span>
            </div>
            <div className="document-actions">
              <button
                className="btn btn-sm btn-icon"
                onClick={() => handleDownload(document)}
                title="Descargar documento"
              >
                <FiDownload />
              </button>
              {canDelete && (
                <button
                  className="btn btn-sm btn-icon btn-danger"
                  onClick={() => handleDelete(document.id)}
                  title="Eliminar documento"
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentList;