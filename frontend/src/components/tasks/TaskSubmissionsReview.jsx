import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { getSubmissionsByStudent } from '../../services/taskService';
import { FiUser, FiCalendar, FiAward, FiMessageSquare, FiFile, FiDownload, FiClock, FiLink } from 'react-icons/fi';
import GradeSubmissionForm from './GradeSubmissionForm';
import Modal from '../common/Modal';
import Loading from '../common/Loading';
import './TaskSubmissionsReview.scss';

const TaskSubmissionsReview = ({ task, onClose }) => {
  const [studentsSubmissions, setStudentsSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [expandedStudent, setExpandedStudent] = useState(null);

  useEffect(() => {
    fetchSubmissions();
  }, [task.id]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const data = await getSubmissionsByStudent(task.id);
      setStudentsSubmissions(data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Error al cargar las entregas');
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionStatus = (submission) => {
    if (submission.status === 'GRADED') return 'Calificada';
    if (submission.status === 'LATE') return 'Tardía';
    if (submission.status === 'SUBMITTED') return 'Entregada';
    return 'Pendiente';
  };

  const getStatusClass = (submission) => {
    if (submission.status === 'GRADED') return 'status-graded';
    if (submission.status === 'LATE') return 'status-late';
    if (submission.status === 'SUBMITTED') return 'status-submitted';
    return 'status-pending';
  };

  const handleGradeComplete = async () => {
    setSelectedSubmission(null);
    await fetchSubmissions();
    toast.success('Calificación guardada exitosamente');
  };

  if (loading) {
    return <Loading text="Cargando entregas..." />;
  }

  return (
    <div className="task-submissions-review">
      {selectedSubmission && (
        <Modal
          title="Calificar Entrega"
          onClose={() => setSelectedSubmission(null)}
          size="large"
        >
          <GradeSubmissionForm
            task={task}
            submission={selectedSubmission}
            onGradeComplete={handleGradeComplete}
            onCancel={() => setSelectedSubmission(null)}
          />
        </Modal>
      )}

      <div className="review-header">
        <h2>Entregas de Estudiantes</h2>
        <div className="task-info">
          <span className="task-name">{task.title}</span>
          <span className="submissions-count">
            {studentsSubmissions.length} {studentsSubmissions.length === 1 ? 'estudiante' : 'estudiantes'}
          </span>
        </div>
      </div>

      {studentsSubmissions.length === 0 ? (
        <div className="empty-state">
          <FiUser size={48} />
          <p>No hay entregas para esta tarea</p>
        </div>
      ) : (
        <div className="students-list">
          {studentsSubmissions.map((studentData) => {
            const latestSubmission = studentData.latest_submission;
            const isExpanded = expandedStudent === studentData.student.id;

            return (
              <div
                key={studentData.student.id}
                className={`student-card ${isExpanded ? 'expanded' : ''}`}
              >
                <div
                  className="student-header"
                  onClick={() => setExpandedStudent(isExpanded ? null : studentData.student.id)}
                >
                  <div className="student-info">
                    <div className="student-avatar">
                      {studentData.student.full_name.charAt(0)}
                    </div>
                    <div className="student-details">
                      <h3 className="student-name">{studentData.student.full_name}</h3>
                      <span className="student-email">{studentData.student.email}</span>
                    </div>
                  </div>

                  <div className="submission-summary">
                    {latestSubmission && (
                      <>
                        <span className={`submission-status ${getStatusClass(latestSubmission)}`}>
                          {getSubmissionStatus(latestSubmission)}
                        </span>
                        {latestSubmission.score !== null && latestSubmission.score !== undefined && (
                          <span className="submission-score">
                            <FiAward />
                            {latestSubmission.score}/{task.max_score}
                          </span>
                        )}
                        <span className="submission-version">
                          v{latestSubmission.version}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="student-submissions">
                    <h4>Historial de Entregas ({studentData.submissions.length})</h4>
                    
                    {studentData.submissions.map((submission) => (
                      <div key={submission.id} className="submission-item">
                        <div className="submission-header">
                          <div className="submission-meta">
                            <span className="submission-version-badge">
                              Versión {submission.version}
                            </span>
                            <span className="submission-date">
                              <FiCalendar />
                              {format(parseISO(submission.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                            </span>
                            <span className={`submission-status ${getStatusClass(submission)}`}>
                              {getSubmissionStatus(submission)}
                            </span>
                          </div>
                          
                          {submission.status !== 'GRADED' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setSelectedSubmission(submission)}
                            >
                              <FiAward /> Calificar
                            </button>
                          )}
                        </div>

                        {submission.notes && (
                          <div className="submission-notes">
                            <FiMessageSquare />
                            <p>{submission.notes}</p>
                          </div>
                        )}

                        {submission.link && (
                          <div className="submission-link">
                            <FiLink />
                            <a href={submission.link} target="_blank" rel="noopener noreferrer">
                              {submission.link}
                            </a>
                          </div>
                        )}

                        {/* Show documents from Document model */}
                        {submission.documents && submission.documents.length > 0 && (
                          <div className="submission-files">
                            <h5><FiFile /> Archivos adjuntos ({submission.documents.length}):</h5>
                            <div className="files-list">
                              {submission.documents.map((doc) => (
                                <div key={doc.id} className="file-item">
                                  <FiFile />
                                  <div className="file-info">
                                    <span className="file-name">{doc.name}</span>
                                    {doc.file_size && (
                                      <span className="file-size">
                                        {(doc.file_size / 1024).toFixed(2)} KB
                                      </span>
                                    )}
                                  </div>
                                  <div className="file-actions">
                                    {doc.drive_file_url ? (
                                      <a
                                        href={doc.drive_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="file-download"
                                        title="Ver en Google Drive"
                                      >
                                        <FiLink /> Drive
                                      </a>
                                    ) : doc.file_url ? (
                                      <a
                                        href={doc.file_url}
                                        download
                                        className="file-download"
                                        title="Descargar archivo"
                                      >
                                        <FiDownload /> Descargar
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Show files from files_metadata JSON field */}
                        {submission.files_metadata && submission.files_metadata.length > 0 && (
                          <div className="submission-files">
                            <h5><FiFile /> Archivos adicionales ({submission.files_metadata.length}):</h5>
                            <div className="files-list">
                              {submission.files_metadata.map((file, idx) => (
                                <div key={idx} className="file-item">
                                  <FiFile />
                                  <div className="file-info">
                                    <span className="file-name">{file.name}</span>
                                    {file.size && (
                                      <span className="file-size">
                                        {(file.size / 1024).toFixed(2)} KB
                                      </span>
                                    )}
                                  </div>
                                  <div className="file-actions">
                                    {file.web_view_link ? (
                                      <a
                                        href={file.web_view_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="file-download"
                                        title="Ver en Google Drive"
                                      >
                                        <FiLink /> Drive
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {submission.status === 'GRADED' && (
                          <div className="grading-info">
                            <div className="grade-header">
                              <FiAward className="grade-icon" />
                              <h5>Calificación</h5>
                            </div>
                            
                            <div className="grade-details">
                              <div className="grade-score">
                                <strong>Puntuación:</strong>
                                <span className="score-value">
                                  {submission.score}/{task.max_score}
                                </span>
                              </div>

                              {submission.teacher_feedback && (
                                <div className="grade-feedback">
                                  <strong>Retroalimentación:</strong>
                                  <p>{submission.teacher_feedback}</p>
                                </div>
                              )}

                              {submission.graded_at && (
                                <div className="grade-date">
                                  <FiClock />
                                  Calificada el {format(parseISO(submission.graded_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TaskSubmissionsReview;
