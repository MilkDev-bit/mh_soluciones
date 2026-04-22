import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { gradeSubmission } from '../../services/taskService';
import { FiAward, FiCheck, FiFile, FiDownload, FiExternalLink, FiLink, FiMessageSquare } from 'react-icons/fi';
import '../../assets/styles/_buttons.scss';

const GradeSubmissionForm = ({ task, submission, onGradeComplete, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = useForm({
    defaultValues: {
      score: submission.score || '',
      teacher_feedback: submission.teacher_feedback || '',
      criteria_scores: submission.criteria_scores || {}
    }
  });

  const [useCriteria, setUseCriteria] = useState(
    task.grading_criteria && task.grading_criteria.length > 0
  );

  const criteria = task.grading_criteria || [];
  const criteriaScores = watch('criteria_scores') || {};

  // Calculate total score from criteria
  const calculateTotalFromCriteria = () => {
    let total = 0;
    criteria.forEach((criterion, index) => {
      const score = parseFloat(criteriaScores[index]) || 0;
      total += score;
    });
    return total;
  };

  const handleCriteriaScoreChange = (index, value) => {
    const newScores = { ...criteriaScores, [index]: value };
    setValue('criteria_scores', newScores);
    
    // Auto-update total score
    if (useCriteria) {
      const total = Object.values(newScores).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      setValue('score', total);
    }
  };

  const onSubmit = async (data) => {
    try {
      const gradeData = {
        score: parseFloat(data.score),
        teacher_feedback: data.teacher_feedback || '',
        status: 'GRADED'
      };

      if (useCriteria && criteria.length > 0) {
        gradeData.criteria_scores = data.criteria_scores;
      }

      await gradeSubmission(task.id, submission.id, gradeData);
      
      toast.success('✅ Entrega calificada exitosamente');
      
      if (onGradeComplete) {
        onGradeComplete();
      }
      
    } catch (error) {
      console.error('Error al calificar:', error);
      
      let errorMessage = 'No se pudo calificar la entrega';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.score) {
          errorMessage = Array.isArray(error.response.data.score) 
            ? error.response.data.score[0] 
            : error.response.data.score;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  if (!submission || !task) {
    return <div style={{padding:'20px', color:'red'}}>Error: Datos de entrega faltantes.</div>;
  }

  // Debug: check for names
  console.log("Rendering GradeSubmissionForm for student:", submission.submitted_by?.full_name);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grading-form">
      <div className="grading-header">
        <FiAward size={24} />
        <h3>Calificar Entrega</h3>
      </div>

      <div className="student-info">
        <p><strong>Estudiante:</strong> {submission?.submitted_by?.first_name} {submission?.submitted_by?.last_name || submission?.submitted_by?.username} </p>
        <p><strong>Fecha:</strong> {submission?.created_at ? new Date(submission.created_at).toLocaleString('es-MX') : 'Fecha desconocida'}</p>
        <p><strong>Versión:</strong> v{submission?.version}</p>
      </div>

      {submission.notes && (
        <div className="submission-notes-preview">
          <FiMessageSquare />
          <p>{submission.notes}</p>
        </div>
      )}

      {submission.link && (
        <div className="submission-link-preview">
          <FiLink />
          <a href={submission.link} target="_blank" rel="noopener noreferrer">{submission.link}</a>
          <FiExternalLink size={12} />
        </div>
      )}

      {/* ── Unified file display: shows ANY file regardless of which upload flow was used ── */}
      {(() => {
        const hasDocs = submission.documents && submission.documents.length > 0;
        const hasMeta = submission.files_metadata && submission.files_metadata.length > 0;
        const hasDriveLink = submission.google_drive_link && submission.uploaded_to_drive;
        const hasDirectFile = submission.file;
        const anyFile = hasDocs || hasMeta || hasDriveLink || hasDirectFile;
        if (!anyFile) return null;
        return (
          <div className="submission-files-preview">
            <h4><FiFile /> Archivos entregados</h4>
            <div className="files-list">
              {hasDocs && submission.documents.map((doc) => (
                <div key={doc.id} className="file-item-preview">
                  {doc.is_link ? <FiLink className="file-icon" /> : <FiFile className="file-icon" />}
                  <div className="file-info">
                    <span className="file-name" title={doc.name}>{doc.name}</span>
                    {!doc.is_link && doc.file_size && <span className="file-size">{(doc.file_size / 1024).toFixed(1)} KB</span>}
                  </div>
                  <div className="file-actions">
                    {doc.is_link ? (
                      <a href={doc.link} target="_blank" rel="noopener noreferrer" className="btn-file-action btn-drive">
                        <FiExternalLink /> Abrir enlace
                      </a>
                    ) : doc.drive_file_url ? (
                      <a href={doc.drive_file_url} target="_blank" rel="noopener noreferrer" className="btn-file-action btn-drive">
                        <FiExternalLink /> Drive
                      </a>
                    ) : doc.file_url ? (
                      <a href={doc.file_url} download className="btn-file-action btn-download">
                        <FiDownload /> Descargar
                      </a>
                    ) : <span style={{fontSize:'0.75rem',color:'#9ca3af'}}>⏳ Procesando...</span>}
                  </div>
                </div>
              ))}
              {hasMeta && !hasDocs && submission.files_metadata.map((file, idx) => (
                <div key={idx} className="file-item-preview">
                  <FiFile className="file-icon" />
                  <div className="file-info"><span className="file-name">{file.name}</span></div>
                  <div className="file-actions">
                    {file.web_view_link && (
                      <a href={file.web_view_link} target="_blank" rel="noopener noreferrer" className="btn-file-action btn-drive">
                        <FiExternalLink /> Drive
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {hasDriveLink && !hasDocs && !hasMeta && (
                <div className="file-item-preview">
                  <FiLink className="file-icon" />
                  <div className="file-info"><span className="file-name">Archivo en Google Drive</span></div>
                  <div className="file-actions">
                    <a href={submission.google_drive_link} target="_blank" rel="noopener noreferrer" className="btn-file-action btn-drive">
                      <FiExternalLink /> Abrir en Drive
                    </a>
                  </div>
                </div>
              )}
              {hasDirectFile && !hasDocs && !hasMeta && !hasDriveLink && (
                <div className="file-item-preview">
                  <FiFile className="file-icon" />
                  <div className="file-info"><span className="file-name">Archivo adjunto</span></div>
                  <div className="file-actions">
                    <a href={submission.file} download className="btn-file-action btn-download">
                      <FiDownload /> Descargar
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {criteria.length > 0 && (
        <div className="form-group">
          <label>
            <input 
              type="checkbox" 
              checked={useCriteria}
              onChange={(e) => setUseCriteria(e.target.checked)}
            />
            {' '}Usar criterios de calificación
          </label>
        </div>
      )}

      {useCriteria && criteria.length > 0 ? (
        <div className="criteria-section">
          <h4>Criterios de Evaluación</h4>
          <div className="criteria-list">
            {criteria.map((criterion, index) => (
              <div key={index} className="criterion-item">
                <div className="criterion-info">
                  <div className="criterion-name">{criterion.name}</div>
                  {criterion.description && (
                    <div className="criterion-description">{criterion.description}</div>
                  )}
                  <div className="criterion-max">Máximo: {criterion.points} puntos</div>
                </div>
                <div className="criterion-score">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={criterion.points}
                    placeholder="0"
                    value={criteriaScores[index] || ''}
                    onChange={(e) => handleCriteriaScoreChange(index, e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="total-score">
            <strong>Puntuación Total:</strong> {calculateTotalFromCriteria()} / {task.max_score}
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label" htmlFor="score">
            Puntuación *
          </label>
          <input
            id="score"
            type="number"
            step="0.01"
            min="0"
            max={task.max_score}
            className="form-input"
            {...register('score', {
              required: 'La puntuación es obligatoria',
              min: { value: 0, message: 'La puntuación no puede ser negativa' },
              max: { value: task.max_score, message: `La puntuación no puede exceder ${task.max_score}` }
            })}
          />
          {errors.score && <span className="error-message">{errors.score.message}</span>}
          <small>Puntuación máxima: {task.max_score}</small>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="teacher_feedback">
          Retroalimentación
        </label>
        <textarea
          id="teacher_feedback"
          className="form-input"
          rows="5"
          placeholder="Escribe comentarios, observaciones o sugerencias para el estudiante..."
          {...register('teacher_feedback')}
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
          disabled={isSubmitting}
        >
          <FiCheck />
          {isSubmitting ? 'Guardando...' : 'Guardar Calificación'}
        </button>
      </div>

      <style jsx>{`
        .grading-form {
          padding: 1.5rem;
        }

        .grading-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e5e7eb;
        }

        .grading-header svg {
          color: #f97316;
        }

        .grading-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .student-info {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .student-info p {
          margin: 0.5rem 0;
          color: #374151;
          font-size: 0.9375rem;
        }

        .criteria-section {
          margin-bottom: 1.5rem;
        }

        .criteria-section h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
          margin-bottom: 1rem;
        }

        .total-score {
          padding: 1rem;
          background: #fff7ed;
          border: 2px solid #fed7aa;
          border-radius: 8px;
          text-align: right;
          font-size: 1.125rem;
          color: #9a3412;
          margin-top: 1rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.5rem;
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

        .error-message {
          color: #ef4444;
          font-size: 0.8125rem;
          margin-top: 0.25rem;
          display: block;
        }

        small {
          color: #6b7280;
          font-size: 0.8125rem;
          display: block;
          margin-top: 0.25rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          padding-top: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .submission-files-preview {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }
        .submission-files-preview h4 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: #166534;
          margin: 0 0 0.75rem;
        }
        .file-item-preview {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          background: white;
          border: 1px solid #d1fae5;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }
        .file-info { flex: 1; min-width: 0; }
        .file-name {
          display: block;
          font-weight: 500;
          font-size: 0.875rem;
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .file-size { display: block; font-size: 0.75rem; color: #6b7280; }
        .btn-file-action {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.35rem 0.65rem;
          border-radius: 5px;
          font-size: 0.8rem;
          font-weight: 500;
          text-decoration: none;
        }
        .btn-drive { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .btn-drive:hover { background: #bfdbfe; }
        .btn-download { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
        .btn-download:hover { background: #e5e7eb; }
        .submission-link-preview {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        .submission-link-preview a { color: #1d4ed8; text-decoration: none; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .submission-notes-preview {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #fafafa;
          border-left: 3px solid #d1d5db;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
          color: #4b5563;
          font-style: italic;
        }
        .submission-notes-preview p { margin: 0; }

        /* Dark mode */
        [data-theme="dark"] .grading-form .grading-header {
          border-bottom-color: #404040;
        }
        [data-theme="dark"] .grading-form .grading-header h3 {
          color: #f5f5f5;
        }
        [data-theme="dark"] .grading-form .student-info {
          background: #262626;
          border: 1px solid #404040;
        }
        [data-theme="dark"] .grading-form .student-info p {
          color: #d4d4d4;
        }
        [data-theme="dark"] .grading-form .criteria-section h4 {
          color: #e5e5e5;
        }
        [data-theme="dark"] .grading-form .total-score {
          background: rgba(249, 115, 22, 0.15);
          border-color: rgba(249, 115, 22, 0.35);
          color: #fdba74;
        }
        [data-theme="dark"] .grading-form .form-label {
          color: #d4d4d4;
        }
        [data-theme="dark"] .grading-form .form-input {
          background: #262626;
          border-color: #404040;
          color: #e5e5e5;
          color-scheme: dark;
        }
        [data-theme="dark"] .grading-form .form-input::placeholder {
          color: #737373;
        }
        [data-theme="dark"] .grading-form .form-input:focus {
          background: #262626;
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
        }
        [data-theme="dark"] .grading-form small {
          color: #a3a3a3;
        }
        [data-theme="dark"] .grading-form .form-actions {
          border-top-color: #404040;
        }
        [data-theme="dark"] .grading-form .submission-files-preview {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.25);
        }
        [data-theme="dark"] .grading-form .submission-files-preview h4 {
          color: #6ee7b7;
        }
        [data-theme="dark"] .grading-form .file-item-preview {
          background: #262626;
          border-color: rgba(16, 185, 129, 0.2);
        }
        [data-theme="dark"] .grading-form .file-name {
          color: #e5e5e5;
        }
        [data-theme="dark"] .grading-form .file-size {
          color: #a3a3a3;
        }
        [data-theme="dark"] .grading-form .btn-drive {
          background: rgba(59, 130, 246, 0.15);
          color: #93c5fd;
          border-color: rgba(59, 130, 246, 0.3);
        }
        [data-theme="dark"] .grading-form .btn-drive:hover {
          background: rgba(59, 130, 246, 0.25);
        }
        [data-theme="dark"] .grading-form .btn-download {
          background: #333;
          color: #d4d4d4;
          border-color: #404040;
        }
        [data-theme="dark"] .grading-form .btn-download:hover {
          background: #404040;
        }
        [data-theme="dark"] .grading-form .submission-link-preview {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.25);
        }
        [data-theme="dark"] .grading-form .submission-link-preview a {
          color: #93c5fd;
        }
        [data-theme="dark"] .grading-form .submission-notes-preview {
          background: #262626;
          border-left-color: #525252;
          color: #a3a3a3;
        }
      `}</style>
    </form>
  );
};

export default GradeSubmissionForm;
