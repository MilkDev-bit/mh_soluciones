import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { addTaskSubmission } from '../../services/taskService';
import { FiUpload, FiX, FiFile } from 'react-icons/fi';
import '../../assets/styles/_buttons.scss';

const TaskSubmissionForm = ({ task, onSubmissionComplete, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file sizes (max 100MB per file)
    const maxSize = 900 * 1024 * 1024; // 900MB in bytes
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} excede el tamaño máximo de 100MB`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FiFile />;
    
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation')) return '📽️';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
    
    return <FiFile />;
  };

  const onSubmit = async (data) => {
    try {
      if (selectedFiles.length === 0 && !data.notes?.trim() && !data.link?.trim()) {
        toast.error('Debes subir al menos un archivo, agregar un comentario o un enlace');
        return;
      }

      const formData = new FormData();
      
      // ✅ FIX: Backend expects 'files[]' for multiple files
      selectedFiles.forEach((file) => {
        formData.append('files[]', file);
      });
      
      // Add notes/comment
      if (data.notes?.trim()) {
        formData.append('notes', data.notes);
      }

      // Add link if provided
      if (data.link?.trim()) {
        formData.append('link', data.link);
      }

      setUploadProgress(10);
      
      const result = await addTaskSubmission(task.id, formData);
      
      setUploadProgress(100);
      
      // Reset form
      setSelectedFiles([]);
      
      if (onSubmissionComplete) {
        onSubmissionComplete(result);
      }
      
    } catch (error) {
      console.error('Error al subir entrega:', error);
      
      let errorMessage = 'No se pudo realizar la entrega';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      toast.error(errorMessage);
      setUploadProgress(0);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="submission-form">
      <div className="form-section">
        <h3>Subir Archivos</h3>
        
        <div className="file-upload-area">
          <input
            type="file"
            id="file-upload"
            multiple
            onChange={handleFileChange}
            accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.zip,.rar,.mp4,.mov"
            style={{ display: 'none' }}
          />
          
          <label htmlFor="file-upload" className="upload-label">
            <FiUpload size={32} />
            <p>Arrastra archivos aquí o haz clic para seleccionar</p>
            <small>PDF, DOCX, PPTX, XLSX, imágenes, ZIP, RAR, video (máx. 100MB por archivo)</small>
          </label>
        </div>

        {selectedFiles.length > 0 && (
          <div className="selected-files-preview">
            <h4><FiFile /> Archivos seleccionados ({selectedFiles.length})</h4>
            <div className="files-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-preview-item">
                  <div className="file-icon">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="file-info">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="remove-file-btn"
                    aria-label={`Eliminar ${file.name}`}
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span>{uploadProgress}%</span>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3>Enlace (Opcional)</h3>
        <input
          type="url"
          className="form-input"
          placeholder="https://..."
          {...register('link')}
        />
      </div>

      <div className="form-section">
        <h3>Comentarios / Notas</h3>
        <textarea
          className="form-input"
          rows="4"
          placeholder="Agrega comentarios o notas sobre tu entrega..."
          {...register('notes')}
        />
      </div>

      <div className="form-actions">
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={isSubmitting || (selectedFiles.length === 0 && !watch('notes'))}
        >
          {isSubmitting ? 'Subiendo...' : 'Entregar Tarea'}
        </button>
      </div>

      <style jsx>{`
        .submission-form {
          padding: 1rem;
        }

        .form-section {
          margin-bottom: 2rem;
        }

        .form-section h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #111827;
        }

        .file-upload-area {
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          transition: all 0.3s ease;
        }

        .file-upload-area:hover {
          border-color: #f97316;
          background: rgba(249, 115, 22, 0.05);
        }

        .upload-label {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          color: #6b7280;
        }

        .upload-label svg {
          color: #f97316;
        }

        .upload-label p {
          font-weight: 500;
          color: #374151;
          margin: 0;
        }

        .upload-label small {
          font-size: 0.8125rem;
          color: #9ca3af;
        }

        .selected-files-preview {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(59, 130, 246, 0.05);
          border: 2px dashed rgba(59, 130, 246, 0.3);
          border-radius: 8px;
        }

        .selected-files-preview h4 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-size: 0.9rem;
          color: #1e40af;
        }

        .files-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .file-preview-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .file-preview-item:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
        }

        .file-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .file-info {
          flex: 1;
          min-width: 0;
        }

        .file-name {
          display: block;
          font-weight: 500;
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.125rem;
        }

        .remove-file-btn {
          padding: 0.5rem;
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-file-btn:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .remove-file-btn svg {
          font-size: 1.25rem;
        }

        .upload-progress {
          margin-top: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .progress-bar {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f97316, #ea580c);
          transition: width 0.3s ease;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.9375rem;
        }

        .form-input:focus {
          outline: none;
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }
      `}</style>
    </form>
  );
};

export default TaskSubmissionForm;
