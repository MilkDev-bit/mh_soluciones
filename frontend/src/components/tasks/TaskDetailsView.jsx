import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  updateTask,
  deleteTask,
  addTaskComment,
  addTaskSubmission,
  getTaskComments,
  getTaskSubmissions,
  duplicateTask,
  extendTaskDeadline,
  reviewSubmission
} from '../../services/taskService';
import {
  taskStatusLabel, taskStatusClass, taskDeadlineLabel, isTaskDone, formatDateTime, apiErrorMessage,
} from '../../utils/taskStatus';
import DeadlineBanner from './DeadlineBanner';
import { uploadDocument, getDocumentsByTask, getFileUrl } from '../../services/documentService';
import {
  FiDownload, FiUpload, FiX, FiClock, FiUser, FiFile, FiCheckCircle,
  FiAlertCircle, FiEdit, FiTrash2, FiSave, FiRotateCw, FiPaperclip,
  FiEye, FiMessageSquare, FiSend, FiLink, FiUploadCloud, FiCalendar, FiRefreshCw, FiAward, FiUsers, FiExternalLink,
  FiFileText, FiImage, FiMusic, FiVideo, FiArchive, FiBarChart, FiCopy
} from 'react-icons/fi';
import TaskSubmissionsReview from './TaskSubmissionsReview';
import TaskSubmissionForm from './TaskSubmissionForm';
import TaskForm from './TaskForm';
import GraficasActivityTable from './GraficasActivityTable';
import Modal from '../common/Modal';
import ExtendDeadlineModal from './ExtendDeadlineModal';
import { invalidateTaskQueries } from '../../utils/taskCache';
import './TaskDetailsView.scss';
import { visibleDescription } from '../../utils/taskDescription';
import { confirmDialog } from '../common/ConfirmDialog';

// File icon mapping for different file types
const FILE_ICON_MAP = {
  // Documents
  'pdf': FiFileText,
  'doc': FiFileText,
  'docx': FiFileText,
  'txt': FiFileText,
  // Images
  'jpg': FiImage,
  'jpeg': FiImage,
  'png': FiImage,
  'gif': FiImage,
  'svg': FiImage,
  'webp': FiImage,
  // Spreadsheets
  'xls': FiBarChart,
  'xlsx': FiBarChart,
  'csv': FiBarChart,
  // Presentations
  'ppt': FiFileText,
  'pptx': FiFileText,
  // Compressed
  'zip': FiArchive,
  'rar': FiArchive,
  '7z': FiArchive,
  // Videos
  'mp4': FiVideo,
  'avi': FiVideo,
  'mov': FiVideo,
  'mkv': FiVideo,
  'webm': FiVideo,
  // Audio
  'mp3': FiMusic,
  'wav': FiMusic,
  'flac': FiMusic,
  'ogg': FiMusic,
  // Default
  default: FiFile
};

const EDIT_FORM_ID = 'task-details-edit-form';

const TaskDetailsView = ({
  task, user, project, projectMembers, onClose,
  onTaskUpdated: onTaskUpdatedProp, onTaskDeleted: onTaskDeletedProp, onDocumentUpload,
}) => {
  // Cualquier cambio a la tarea (cerrar, ampliar plazo, editar, eliminar…)
  // refresca TODAS las vistas que la muestran, no solo la que abrió el modal.
  const queryClient = useQueryClient();
  const onTaskUpdated = (...args) => {
    invalidateTaskQueries(queryClient);
    return onTaskUpdatedProp?.(...args);
  };
  const onTaskDeleted = (...args) => {
    invalidateTaskQueries(queryClient);
    return onTaskDeletedProp?.(...args);
  };
  const [file, setFile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentingSubmission, setCommentingSubmission] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showSubmissionsReview, setShowSubmissionsReview] = useState(false);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);

  const { register: commentRegister, handleSubmit: commentHandleSubmit, reset: commentReset } = useForm();
  const { register: submissionRegister, handleSubmit: submissionHandleSubmit, reset: submissionReset } = useForm();

  const userRole = user?.role || '';
  
  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'CEO' || userRole === 'RH';
  const isClient = userRole === 'CLIENT';
  const canEditOrDeleteTask = userRole === 'SUPERADMIN';
  const canCompleteTask = userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'PROFESSOR' || userRole === 'DIRECTOR';
  const isStudent = userRole === 'STUDENT';
  
  // Desde la página de Tareas no llega `project`: se arma con los datos de la
  // tarea. Sin esto, editar desde Tareas fallaba con "proyecto no seleccionado".
  const formProject = project?.id
    ? project
    : (task?.project && typeof task.project === 'object'
      ? task.project
      : (task?.project ? { id: task.project, name: task.project_name } : null));

  const isInAssignedStudents = Array.isArray(task?.assigned_students_data) &&
                               task.assigned_students_data.some(s => s.id === user?.id);
  const canSubmit = (user?.id && task?.assigned_to?.id && user.id === task.assigned_to.id) || isInAssignedStudents || isAdmin;
  const canInteract = isAdmin ||
                      isClient ||
                      (user?.id && task?.created_by?.id && user.id === task.created_by.id) || 
                      (user?.id && task?.assigned_to?.id && user.id === task.assigned_to.id) ||
                      isInAssignedStudents;

  useEffect(() => {
    if (task && task.id) {
      loadTaskComments();
      fetchSubmissions();
      loadDocuments();
    }
  }, [task]);

  const loadTaskComments = async () => {
    if (!task?.id) return;
    try {
      const response = await getTaskComments(task.id);
      const commentsData = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];
      setTaskComments(commentsData);
    } catch (error) {
      console.error('Error loading task comments:', error);
      setTaskComments([]);
    }
  };
  
  const loadDocuments = async () => {
    if (!task?.id) return;
    try {
      const docs = await getDocumentsByTask(task.id);
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error al cargar los documentos');
      setDocuments([]);
    }
  };

  const fetchSubmissions = async () => {
    if (!task?.id) return;
    try {
      const data = await getTaskSubmissions(task.id);
      const submissionsData = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setSubmissions(submissionsData || []);
    } catch (error) {
      console.error('Error al cargar entregas:', error);
      toast.error('⚠️ No se pudieron cargar las entregas');
      setSubmissions([]);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 40 * 1024 * 1024) {
        toast.error('El archivo no puede ser mayor a 40MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return toast.error('Selecciona un archivo primero');
    if (!task || !task.id) return toast.error('Error: No se ha seleccionado una tarea válida.');

    setLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('task', task.id);
      formData.append('file', file);
      formData.append('notes', submissionNotes || `Entrega - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await uploadDocument(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast.success('✅ Archivo entregado correctamente');
      setFile(null);
      setSubmissionNotes('');

      await loadDocuments();
      if (typeof onDocumentUpload === 'function') {
        onDocumentUpload();
      }

      setTimeout(() => setUploadProgress(0), 1000);
    } catch (error) {
      console.error('Error al subir archivo:', error);
      
      // Show specific error message based on error type
      let errorMessage = '❌ Error al subir el archivo';
      
      if (error.type === 'refresh_error') {
        errorMessage = '❌ Las credenciales de Google Drive han expirado. Contacte al administrador.';
      } else if (error.type === 'permission_error') {
        errorMessage = '❌ Sin permisos para subir a Google Drive. Contacte al administrador.';
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      } else if (error.response?.data?.message) {
        errorMessage = `❌ ${error.response.data.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onSubmissionSubmit = async (data) => {
    if (!task || !task.id) {
        toast.error("Error: No se pudo identificar la tarea. Intenta recargar la página.");
        return;
    }
    if (!data.link && (!data.file || data.file.length === 0)) {
      toast.error('Debes proporcionar un enlace o un archivo.');
      return;
    }
    const formData = new FormData();
    formData.append('task', task.id);
    formData.append('notes', data.notes || '');
    formData.append('link', data.link || '');
    if (data.file && data.file[0]) {
      formData.append('file', data.file[0]);
    }
    try {
      const newSubmission = await addTaskSubmission(task.id, formData);
      setSubmissions(prev => [...prev, newSubmission]);
      submissionReset();
      toast.success('Entrega añadida con éxito');
      await fetchSubmissions();
    } catch (error) {
      toast.error('No se pudo añadir la entrega.');
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !task.id) return;
    const ok = await confirmDialog({
      title: 'Eliminar tarea',
      message: '¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    setDeleteLoading(true);
    try {
      await deleteTask(task.id);
      toast.success('✅ Tarea eliminada correctamente');
      
      if (typeof onTaskDeleted === 'function') {
        onTaskDeleted(task.id);
      }
      
      onClose();
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
      toast.error(error.response?.data?.message || '❌ Error al eliminar la tarea');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onCommentSubmit = async (data) => {
    if (!task || !task.id || !data.comment.trim()) return;
    try {
      await addTaskComment(task.id, { comment: data.comment });
      toast.success('Comentario añadido correctamente');
      await loadTaskComments();
      commentReset();
    } catch (error) {
      toast.error('No se pudo añadir el comentario.');
      console.error("Error al añadir comentario:", error);
    }
  };

  // Etiquetas para TODOS los estados (antes OPEN, CLOSED, REOPENED... se
  // mostraban como el código crudo o como "Pendiente").
  // [FIX] El botón "Enviar comentario" llamaba a handleAddComment, que no
  // existía (ReferenceError). Ahora devuelve la entrega con cambios usando el
  // flujo de revisión, con su notificación correcta para el alumno.
  const handleAddComment = async () => {
    if (!commentingSubmission || !commentText.trim()) return;
    try {
      const result = await reviewSubmission(task.id, commentingSubmission.id, {
        decision: 'request_changes',
        teacher_feedback: commentText.trim(),
      });
      toast.success(result?.message || 'Entrega devuelta con cambios');
      setCommentingSubmission(null);
      setCommentText('');
      await fetchSubmissions();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'No se pudo enviar el comentario'));
    }
  };

  const getStatusText = () => taskStatusLabel(task);
  const getStatusBadgeClass = (status) => taskStatusClass(status);
 
  const getPriorityText = (priority) => {
    const priorityMap = { 'LOW': 'Baja', 'MEDIUM': 'Media', 'HIGH': 'Alta' };
    return priorityMap[priority] || priority;
  };
 
  const getPriorityBadgeClass = (priority) => {
    const priorityClasses = { 'LOW': 'priority-low', 'MEDIUM': 'priority-medium', 'HIGH': 'priority-high' };
    return priorityClasses[priority] || 'priority-medium';
  };
 
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
 
  const isViewableFile = (filename) => {
    if (!filename) return false;
    return /\.(jpg|jpeg|png|gif|bmp|webp|pdf)$/i.test(filename);
  };

  const getFileNameFromUrl = (fileUrl) => {
    if (!fileUrl) return null;
    try {
      const urlParts = fileUrl.split('/');
      const fileNameWithParams = urlParts[urlParts.length - 1];
      const fileName = fileNameWithParams.split('?')[0];
      return decodeURIComponent(fileName);
    } catch (error) {
      console.error('Error extracting filename from URL:', error);
      return null;
    }
  };

  const getFileExtension = (fileName) => {
    if (!fileName) return '';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const getFileIcon = (extension) => {
    // Map file extensions to React icons for better accessibility
    return FILE_ICON_MAP[extension] || FILE_ICON_MAP.default;
  };
 
  const filesToShow = Array.isArray(documents) && documents.length > 0 ? documents : Array.isArray(submissions) ? submissions : [];

  const handleMarkAsCompleted = async () => {
    if (!task || !task.id) return;
    const ok = await confirmDialog({
      title: '¿Cerrar esta tarea para TODOS los alumnos?',
      message: 'Ya no se aceptarán entregas. Para aprobar o devolver la entrega de un alumno usa "Revisar entregas".',
      confirmText: 'Cerrar tarea',
    });
    if (!ok) return;
    setIsCompleting(true);
    try {
      const updatedTaskData = await updateTask(task.id, { status: 'COMPLETED' });
      toast.success('Tarea cerrada. Ya no recibe entregas.');
      
      if (typeof onTaskUpdated === 'function') {
        onTaskUpdated(updatedTaskData);
      }
      
      onClose();
    } catch (error) {
      toast.error('No se pudo actualizar la tarea.');
      console.error("Error al marcar como completada:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDuplicateTask = async () => {
    if (!task || !task.id) return;
    const ok = await confirmDialog({
      title: 'Duplicar tarea',
      message: 'Se creará una nueva tarea con el mismo nombre y los estudiantes asignados. La fecha de apertura será hoy y la de cierre el próximo domingo a las 2:00 PM.',
      confirmText: 'Duplicar',
    });
    if (!ok) return;
    setIsDuplicating(true);
    try {
      await duplicateTask(task.id);
      toast.success('Tarea duplicada exitosamente');
      if (typeof onTaskUpdated === 'function') {
        onTaskUpdated();
      }
    } catch (error) {
      toast.error(error?.message || 'No se pudo duplicar la tarea.');
      console.error('Error al duplicar tarea:', error);
    } finally {
      setIsDuplicating(false);
    }
  };

  // Antes "Pedir cambios" regresaba la TAREA COMPLETA a "En progreso" para
  // todos los alumnos. Ahora los cambios se piden por entrega desde el
  // tablero de revisión, y aquí solo se amplía el plazo general sin editar
  // las fechas a mano.
  const handleExtendForAll = async ({ days, reason }) => {
    if (!task || !task.id) return;
    setIsReassigning(true);
    try {
      const result = await extendTaskDeadline(task.id, { days, reason });
      toast.success(result?.message || 'Plazo ampliado');
      setShowExtendModal(false);
      if (typeof onTaskUpdated === 'function') onTaskUpdated(result?.task);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'No se pudo ampliar el plazo.'));
    } finally {
      setIsReassigning(false);
    }
  };

  const getFileType = (filename) => {
    if (!filename) return 'unknown';
    if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename)) return 'image';
    if (/\.pdf$/i.test(filename)) return 'pdf';
    return 'other';
  };

  const formatCreatedAt = () => {
    if (!task?.created_at) return 'Fecha desconocida';
    try {
      return format(parseISO(task.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es });
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'Fecha desconocida';
    }
  };

  const formatDueDate = () => taskDeadlineLabel(task) || 'Sin fecha límite';

  const handleRefreshData = async () => {
    await Promise.all([loadTaskComments(), fetchSubmissions(), loadDocuments()]);
    toast.success('Datos actualizados');
  };

  const handleSubmissionComplete = (result) => {
    setShowSubmissionForm(false);
    if (typeof onClose === 'function') {
      onClose();
    }
    setTimeout(() => {
      toast.success(`✅ ${result?.message || '¡Tarea entregada exitosamente!'}`, {
        duration: 5000,
        style: {
          background: '#16a34a',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(22,163,74,0.35)',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#16a34a',
        },
      });
    }, 300);
  };

  return (
    <div className="task-details-view">
      {showSubmissionsReview && (
        <Modal
          title="Revisar Entregas"
          onClose={() => setShowSubmissionsReview(false)}
          size="large"
        >
          <TaskSubmissionsReview
            task={task}
            user={user}
            onClose={() => setShowSubmissionsReview(false)}
          />
        </Modal>
      )}

      {showExtendModal && (
        <ExtendDeadlineModal
          task={task}
          saving={isReassigning}
          onConfirm={handleExtendForAll}
          onClose={() => setShowExtendModal(false)}
        />
      )}

      {showSubmissionForm && (
        <Modal
          title="Entregar Tarea"
          onClose={() => setShowSubmissionForm(false)}
          size="medium"
        >
          <TaskSubmissionForm
            task={task}
            onSubmissionComplete={handleSubmissionComplete}
            onCancel={() => setShowSubmissionForm(false)}
          />
        </Modal>
      )}

      {showModal && selectedFile && (
        <div className="file-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="file-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Vista previa del archivo</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <FiX size={24} />
              </button>
            </div>
            <div className="modal-body">
              {getFileType(selectedFile.file || selectedFile.name) === 'image' ? (
                <div className="image-preview-container">
                  <img src={getFileUrl(selectedFile.file || selectedFile.file_url)} alt="Vista previa" className="file-preview-image" onError={(e) => { e.target.style.display = 'none'; const fallback = e.target.parentElement.querySelector('.image-fallback'); if (fallback) fallback.style.display = 'block'; }} onLoad={(e) => { const fallback = e.target.parentElement.querySelector('.image-fallback'); if (fallback) fallback.style.display = 'none'; }} />
                  <div className="image-fallback" style={{ display: 'none' }}><FiFile size={64} /><p>No se puede cargar la imagen</p><p className="file-error">Error de conexión con el servidor</p></div>
                </div>
              ) : getFileType(selectedFile.file || selectedFile.name) === 'pdf' ? (
                <div className="pdf-preview-container">
                  <iframe src={`${getFileUrl(selectedFile.file || selectedFile.file_url)}#view=fitH`} className="file-preview-iframe" title="Vista previa PDF" onError={(e) => { const container = e.target.parentElement; const fallback = container.querySelector('.pdf-fallback'); if (fallback) fallback.style.display = 'block'; }} />
                  <div className="pdf-fallback" style={{ display: 'none' }}><FiFile size={64} /><p>No se puede cargar el PDF</p></div>
                </div>
              ) : (
                <div className="file-preview-unsupported"><FiFile size={64} /><p>Vista previa no disponible para este tipo de archivo</p><p className="file-type">Tipo: {selectedFile.file?.split('.').pop() || selectedFile.name?.split('.').pop() || 'desconocido'}</p></div>
              )}
            </div>
            <div className="modal-footer">
              <a href={getFileUrl(selectedFile.file || selectedFile.file_url)} download className="btn btn-secondary"><FiDownload /> Descargar</a>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {commentingSubmission && (
        <div className="comment-modal-overlay" onClick={() => setCommentingSubmission(null)}>
          <div className="comment-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar comentario de corrección</h3>
              <button className="modal-close" onClick={() => setCommentingSubmission(null)}><FiX size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="submission-info">
                <h4>Entrega de: {commentingSubmission.submitted_by?.first_name} {commentingSubmission.submitted_by?.last_name}</h4>
                <p className="submission-date">Fecha: {format(parseISO(commentingSubmission.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              <div className="comment-form">
                <label>Mensaje de corrección:</label>
                <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escribe aquí los comentarios para que el alumno pueda corregir su trabajo..." rows={5} className="comment-textarea" />
                <div className="comment-tips"><small>💡 Sugerencia: Sé específico y constructivo en tus comentarios</small></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCommentingSubmission(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => handleAddComment()} disabled={!commentText.trim()}><FiSend /> Devolver con cambios</button>
            </div>
          </div>
        </div>
      )}

      <div className="task-header">
        <div className="header-content">

          <div className="header-actions">
            <button className="btn btn-icon btn-secondary" onClick={handleRefreshData} title="Actualizar datos">
              <FiRefreshCw size={18} />
            </button>

            {canCompleteTask && !isEditing && (
              <div className="action-group">
                {!isTaskDone(task) && (
                  <button
                    className="btn btn-success btn-icon"
                    onClick={handleMarkAsCompleted}
                    disabled={isCompleting}
                    title="Cierra la tarea para todos: ya no se aceptan entregas"
                  >
                    <FiCheckCircle />
                    {isCompleting ? 'Cerrando...' : 'Cerrar Tarea'}
                  </button>
                )}
                {!task?.is_continuous && (isTaskDone(task) || task?.is_overdue) && (
                  <button
                    className="btn btn-warning btn-icon"
                    onClick={() => setShowExtendModal(true)}
                    disabled={isReassigning}
                    title="Da más días a todos sin editar la fecha de la tarea"
                  >
                    <FiRotateCw />
                    {isReassigning ? 'Guardando...' : 'Ampliar plazo'}
                  </button>
                )}
              </div>
            )}

            {canEditOrDeleteTask && (
              <div className="action-group">
                {isEditing ? (
                  <>
                    {/* [FIX] Antes este botón guardaba una copia de la tarea tomada al
                        abrirla (handleEditTask/editedTask), no lo escrito en el
                        formulario: los cambios se perdían, y en tareas sin
                        fecha (GRAFICAS) daba error 400. Ahora envía el
                        formulario de edición, igual que "Guardar Cambios". */}
                    <button type="submit" form={EDIT_FORM_ID} className="btn btn-icon btn-success"><FiSave size={18} />Guardar</button>
                    <button className="btn btn-icon btn-secondary" onClick={() => setIsEditing(false)}><FiX size={18} />Cancelar</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-icon btn-primary" onClick={() => setIsEditing(true)}><FiEdit size={18} />Editar</button>
                    <button className="btn btn-icon btn-danger" onClick={handleDeleteTask} disabled={deleteLoading}><FiTrash2 size={18} />{deleteLoading ? 'Eliminando...' : 'Eliminar'}</button>
                  </>
                )}
                {(isTaskDone(task) || task?.is_overdue) && userRole === 'SUPERADMIN' && !isEditing && (
                  <button
                    className="btn btn-icon btn-secondary"
                    onClick={handleDuplicateTask}
                    disabled={isDuplicating}
                    title="Duplicar tarea para esta semana"
                  >
                    <FiCopy size={18} />
                    {isDuplicating ? 'Duplicando...' : 'Duplicar'}
                  </button>
                )}
              </div>
            )}
            
            <div className="action-group">
              <button className="btn btn-icon btn-secondary" onClick={onClose}><FiX size={20} /></button>
            </div>
          </div>
        </div>

        {!isEditing && task && (
          <div className="status-priority-badges">
            <div className={`status-badge ${getStatusBadgeClass(task.status)}`}>{getStatusText()}</div>
            {task.is_continuous && <div className="status-badge status-progress">Actividad continua</div>}
            <div className={`priority-badge ${getPriorityBadgeClass(task.priority)}`}>{getPriorityText(task.priority)}</div>
          </div>
        )}
      </div>

      <div className="task-content">
        {isEditing ? (
          <div className="edit-task-container">
            <TaskForm 
              formId={EDIT_FORM_ID}
              project={formProject}
              task={task}
              projectMembers={projectMembers}
              onCancel={() => setIsEditing(false)}
              onTaskSaved={(updatedTask) => {
                if (typeof onTaskUpdated === 'function') {
                  onTaskUpdated(updatedTask);
                }
                setIsEditing(false);
              }}
            />
          </div>
        ) : (
          <>
            {task?.title && task.title.toUpperCase().includes('GRAFICAS') && (
              <div className="graficas-activity-section" style={{ margin: '15px 0' }}>
                <GraficasActivityTable task={task} project={task.project} onDataSaved={(updatedTask) => {
                  if (typeof onTaskUpdated === 'function') onTaskUpdated(updatedTask);
                }} />
              </div>
            )}
            {(() => {
              if (!task?.description) return null;
              const cleanDesc = visibleDescription(task.description);
              if (!cleanDesc) return null;
              return (<div className="task-description"><h4>Descripción</h4><p>{cleanDesc}</p></div>);
            })()}
            <div className="task-meta">
              <div className="meta-item"><FiClock className="meta-icon" /><span><strong>Fecha límite:</strong> {formatDueDate()}</span></div>
              {task?.allow_late_submissions && !task?.is_continuous && (
                <div className="meta-item"><FiClock className="meta-icon" /><span><strong>Entregas tardías:</strong> {task.late_deadline ? `hasta ${formatDateTime(task.late_deadline)}` : 'sin límite'}</span></div>
              )}
              {(task?.assigned_students_data?.length > 0 || task?.assigned_to) && (
                <div className="meta-item">
                  <FiUser className="meta-icon" />
                  <span>
                    <strong>Asignada a:</strong>{' '}
                    {task.assigned_students_data?.length > 0
                      ? task.assigned_students_data.map(s => `${s.first_name || ''} ${s.last_name || ''}`.trim()).join(', ')
                      : `${task.assigned_to.first_name || ''} ${task.assigned_to.last_name || ''}`.trim()}
                  </span>
                </div>
              )}
              {task?.created_by && (<div className="meta-item"><FiUser className="meta-icon" /><span><strong>Creada por:</strong> {task.created_by.first_name} {task.created_by.last_name}</span></div>)}
              <div className="meta-item"><FiCalendar className="meta-icon" /><span><strong>Creada:</strong> {formatCreatedAt()}</span></div>
            </div>

            {/* Teams-like action buttons */}
            {(task?.assigned_to?.id === user?.id || isInAssignedStudents) && (
              <DeadlineBanner window={task?.my_window} />
            )}

            <div className="task-actions">
              {canCompleteTask && (
                <button
                  className="btn primary-action-btn view-submissions-btn"
                  onClick={() => setShowSubmissionsReview(true)}
                >
                  <FiUsers />
                  Revisar Entregas
                  {task?.pending_review_count > 0 && ` (${task.pending_review_count} por revisar)`}
                </button>
              )}
              
              {(task?.assigned_to?.id === user?.id || isInAssignedStudents) && (() => {
                const w = task?.my_window;
                const canSend = !w || w.can_submit;
                const label = !w ? 'Entregar Tarea'
                  : w.state === 'CORRECTION' ? 'Reenviar Corrección'
                  : w.state === 'LATE_WINDOW' ? 'Entregar con Retraso'
                  : task?.my_submission_status === 'SUBMITTED' ? 'Reemplazar Entrega'
                  : canSend ? 'Entregar Tarea'
                  : w.state === 'APPROVED' ? 'Entrega Aprobada'
                  : w.state === 'IN_REVIEW' ? 'En Revisión'
                  : 'Entrega Cerrada';
                return (
                  <button
                    className="btn primary-action-btn submit-task-btn"
                    onClick={() => setShowSubmissionForm(true)}
                    disabled={!canSend}
                    title={w?.message}
                  >
                    <FiUploadCloud />
                    {label}
                  </button>
                );
              })()}
            </div>

            {canInteract && (
              <div className="details-section">
                <h3><FiUploadCloud /> Entregas y Enlaces</h3>
                <div className="submissions-list">
                  {submissions.length > 0 ? submissions.map(sub => {
                    const fileName = getFileNameFromUrl(sub.file);
                    const fileExtension = getFileExtension(fileName);
                    const FileIconComponent = getFileIcon(fileExtension);
                    
                    // Get file size from files_metadata if it exists
                    const fileMetadata = sub.files_metadata && sub.files_metadata.length > 0 
                      ? sub.files_metadata[0] 
                      : null;
                    const fileSize = fileMetadata?.size || null;
                    
                    return (
                      <div key={sub.id} className="submission-item">
                        {/* Header with avatar and student info */}
                        <div className="submission-header">
                          <div className="user-avatar">
                            <img 
                              src={sub.submitted_by?.profile_picture || `https://ui-avatars.com/api/?name=${sub.submitted_by?.first_name || 'U'}`} 
                              alt="avatar" 
                            />
                          </div>
                          <div className="user-info">
                            <strong className="user-name">
                              {sub.submitted_by?.first_name} {sub.submitted_by?.last_name}
                            </strong>
                            <span className="submission-date">
                              entregó el {format(parseISO(sub.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                            </span>
                          </div>
                          
                          {/* Version badge */}
                          {sub.version > 1 && (
                            <span className="version-badge">v{sub.version}</span>
                          )}
                        </div>
                        
                        {/* Submission notes */}
                        {sub.notes && (
                          <div className="submission-notes">
                            <FiMessageSquare className="notes-icon" />
                            <p>"{sub.notes}"</p>
                          </div>
                        )}
                        
                        {/* File information */}
                        {sub.file && fileName && (
                          <div className="file-info-card">
                            <div className="file-icon-wrapper">
                              <FileIconComponent className="file-icon" size={28} />
                            </div>
                            <div className="file-details">
                              <span className="file-name" title={fileName}>{fileName}</span>
                              {fileSize && (
                                <span className="file-size">{formatFileSize(fileSize)}</span>
                              )}
                            </div>
                            <div className="file-actions">
                              <button 
                                className="btn-action btn-view" 
                                onClick={() => { 
                                  setSelectedFile({ file_url: sub.file }); 
                                  setShowModal(true); 
                                }}
                                title="Vista previa"
                              >
                                <FiEye />
                              </button>
                              <a 
                                href={getFileUrl(sub.file)} 
                                download 
                                className="btn-action btn-download"
                                title="Descargar"
                              >
                                <FiDownload />
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {/* Google Drive status */}
                        {sub.file && (
                          <div className="drive-status">
                            {sub.uploaded_to_drive ? (
                              <>
                                <FiCheckCircle className="drive-icon drive-success" />
                                <span className="drive-text drive-success">
                                  Guardado en Google Drive
                                </span>
                                {sub.google_drive_link && (
                                  <a 
                                    href={sub.google_drive_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="drive-link"
                                  >
                                    <FiExternalLink /> Abrir en Drive
                                  </a>
                                )}
                              </>
                            ) : (
                              <>
                                <FiUploadCloud className="drive-icon drive-pending" />
                                <span className="drive-text drive-pending">
                                  Subiendo a Google Drive...
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* External links */}
                        {sub.link && (
                          <div className="external-link-card">
                            <FiLink className="link-icon" />
                            <a 
                              href={sub.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="link-url"
                            >
                              {sub.link}
                            </a>
                            <FiExternalLink className="external-icon" />
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="empty-state">
                      <FiUploadCloud size={48} className="empty-icon" />
                      <p className="empty-text">No hay entregas para esta tarea.</p>
                    </div>
                  )}
                </div>


              </div>
            )}

            {canInteract && (
              <div className="details-section">
                <h3><FiMessageSquare /> Comentarios</h3>
                <div className="comment-list">
                  {taskComments.map(comment => (
                    <div key={comment.id} className="comment-item">
                      <img src={comment.user?.profile_picture || `https://ui-avatars.com/api/?name=${comment.user?.first_name || 'U'}`} alt="avatar" className="comment-avatar" />
                      <div className="comment-content">
                        <div className="comment-header">
                          <strong>{comment.user?.first_name} {comment.user?.last_name}</strong>
                          <span>{format(parseISO(comment.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}</span>
                        </div>
                        <p>{comment.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!isClient && (
                  <form onSubmit={commentHandleSubmit(onCommentSubmit)} className="details-form comment-form">
                    <textarea {...commentRegister('comment', { required: true })} placeholder="Escribe un comentario..." rows="2"></textarea>
                    <button type="submit" className="btn btn-primary"><FiSend /> Enviar</button>
                  </form>
                )}
              </div>
            )}
            
            {isAdmin && !isEditing && Array.isArray(submissions) && submissions.length > 0 && (
              <div className="submissions-section">
                <div className="section-header"><h3>📥 Entregas para Revisión ({submissions.length})</h3><button className="refresh-btn" onClick={fetchSubmissions}><FiRotateCw size={16} />Actualizar</button></div>
                <div className="submissions-grid">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="submission-card">
                      <div className="submission-header"><div className="user-info"><FiUser className="user-icon" /><span className="user-name">{submission.submitted_by?.first_name} {submission.submitted_by?.last_name}</span></div><span className="submission-date">{format(parseISO(submission.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span></div>
                      {submission.notes && (<div className="submission-notes"><p>{submission.notes}</p></div>)}
                      <div className="submission-actions">
                        <div className="action-group">
                          {submission.file && (
                            <button onClick={() => { setSelectedFile(submission); setShowModal(true); }} className="btn btn-icon view-btn" title="Vista previa"><FiEye /></button>
                          )}
                          {submission.file && (
                            <a href={getFileUrl(submission.file)} download className="btn btn-icon download-btn" title="Descargar archivo"><FiDownload /></a>
                          )}
                          {submission.link && (
                            <a href={submission.link} target="_blank" rel="noopener noreferrer" className="btn btn-icon link-btn" title="Abrir enlace"><FiLink /></a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div> 
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TaskDetailsView;