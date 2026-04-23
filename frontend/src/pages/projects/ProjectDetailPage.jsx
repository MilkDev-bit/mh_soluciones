import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProjectById,
  removeProjectMember,
  addProjectComment,
  addProjectSubmission,
  updateProjectComment,
  deleteProjectComment,
  updateProjectSubmission,
  deleteProjectSubmission,
  deleteProject
} from '../../services/projectService';
import { getCurrentUserFromSession } from '../../services/userService';
import { getTasks } from '../../services/taskService';
import { useProjectContext } from '../../contexts/ProjectContext';
import { isAdmin, canViewAnalytics, canAccessDrive, canSubmit } from '../../constants/roles';
import { getDocumentsByProject } from '../../services/documentService';
import { getEventsByProject } from '../../services/calendarService';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import MentionInput from '../../components/common/MentionInput';
import TaskForm from '../../components/tasks/TaskForm';
import TaskDetailsView from '../../components/tasks/TaskDetailsView';
import AddMemberModal from '../../components/projects/AddMemberModal';
import ProjectProgressCharts from '../../components/projects/ProjectProgressCharts';
import StudentPerformance from '../../components/projects/StudentPerformance';
import GoogleDriveFolder from '../../components/projects/GoogleDriveFolder';
import {
  FiEdit2,
  FiPlus,
  FiCheckSquare,
  FiPaperclip,
  FiMessageSquare,
  FiUploadCloud,
  FiSend,
  FiLink,
  FiTrash2,
  FiSave,
  FiX,
  FiCalendar,
  FiClock
} from 'react-icons/fi';
import { format, parseISO, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import './ProjectDetailPage.scss';
import ProjectForm from '../../components/projects/ProjectForm';
import { translateStatus } from '../../utils/projectUtils';
import { handleViewFile } from '../../utils/fileUtils';

// Highlights @username mentions in comment text
const renderCommentText = (text) => {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    /^@\w+$/.test(part) ? (
      <span key={i} className="comment-mention">{part}</span>
    ) : (
      part
    )
  );
};

const ProjectCommentItem = ({ comment, currentUser, onUpdate, onDelete, onReply, members = [] }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(comment?.comment || '');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyMentionIds, setReplyMentionIds] = useState([]);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const canEditOrDelete =
    currentUser?.id === comment?.user?.id ||
    (currentUser?.role && isAdmin(currentUser.role));

  useEffect(() => {
    setEditedText(comment?.comment || '');
  }, [comment]);

  const handleSave = () => {
    if ((editedText || '').trim() !== (comment?.comment || '').trim()) {
      onUpdate(comment.id, { comment: editedText });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
      onDelete(comment.id);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      await onReply(comment.id, { comment: replyText, mentioned_user_ids: replyMentionIds });
      setReplyText('');
      setReplyMentionIds([]);
      setShowReplyForm(false);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const user = comment?.user || {};

  return (
    <div className="comment-item">
      <img
        src={
          user.profile_picture ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent((user.first_name || 'U') + ' ' + (user.last_name || ''))}`
        }
        alt="avatar"
        className="comment-avatar"
      />
      <div className="comment-content">
        <div className="comment-header">
          <strong>{(user.first_name || 'Usuario') + ' ' + (user.last_name || '')}</strong>
          <span>
            {comment?.created_at ? format(parseISO(comment.created_at), 'dd MMM yyyy, HH:mm', { locale: es }) : ''}
          </span>
        </div>

        {isEditing ? (
          <div className="edit-comment-form">
            <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows="3" />
            <div className="edit-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                <FiSave /> Guardar
              </button>
            </div>
          </div>
        ) : (
          <p className="comment-text">{renderCommentText(comment?.comment)}</p>
        )}

        {!isEditing && (
          <div className="comment-footer-row">
            <button className="btn-reply-toggle" onClick={() => setShowReplyForm(v => !v)}>
              <FiMessageSquare size={12} />
              {showReplyForm ? 'Cancelar' : 'Responder'}
            </button>
            {canEditOrDelete && (
              <div className="comment-actions">
                <button onClick={() => setIsEditing(true)} title="Editar">
                  <FiEdit2 size={14} />
                </button>
                <button onClick={handleDelete} title="Eliminar">
                  <FiTrash2 size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {showReplyForm && (
          <div className="reply-form">
            <MentionInput
              value={replyText}
              onChange={setReplyText}
              onMentionedUsersChange={setReplyMentionIds}
              members={members}
              rows={2}
              placeholder="Escribe una respuesta... Usa @ para mencionar a alguien"
            />
            <div className="reply-form-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowReplyForm(false); setReplyText(''); setReplyMentionIds([]); }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || isSubmittingReply}
              >
                <FiSend size={12} /> Enviar respuesta
              </button>
            </div>
          </div>
        )}

        {(comment.replies || []).length > 0 && (
          <div className="replies-list">
            {(comment.replies || []).map(reply => {
              const ru = reply?.user || {};
              const canDeleteReply =
                currentUser?.id === reply?.user?.id ||
                (currentUser?.role && isAdmin(currentUser.role));
              return (
                <div key={reply.id} className="reply-item">
                  <img
                    src={
                      ru.profile_picture ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent((ru.first_name || 'U') + ' ' + (ru.last_name || ''))}`
                    }
                    alt="avatar"
                    className="reply-avatar"
                  />
                  <div className="reply-content">
                    <div className="reply-header">
                      <strong>{(ru.first_name || 'Usuario') + ' ' + (ru.last_name || '')}</strong>
                      <span>
                        {reply.created_at ? format(parseISO(reply.created_at), 'dd MMM yyyy, HH:mm', { locale: es }) : ''}
                      </span>
                    </div>
                    <p className="reply-text">{renderCommentText(reply.comment)}</p>
                    {canDeleteReply && (
                      <button
                        className="btn-delete-reply"
                        onClick={() => window.confirm('¿Eliminar esta respuesta?') && onDelete(reply.id)}
                        title="Eliminar respuesta"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectSubmissionItem = ({ submission, currentUser, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubmission, setEditedSubmission] = useState({
    notes: submission?.notes || '',
    link: submission?.link || ''
  });
  const [newFile, setNewFile] = useState(null);

  useEffect(() => {
    setEditedSubmission({
      notes: submission?.notes || '',
      link: submission?.link || ''
    });
    setNewFile(null);
  }, [submission]);

  const canEditOrDelete =
    currentUser?.id === submission?.submitted_by?.id ||
    (currentUser?.role && isAdmin(currentUser.role));

  const user = submission?.submitted_by || {};

  const handleSave = () => {
    const formData = new FormData();
    let hasChanges = false;

    if ((editedSubmission.notes || '') !== (submission?.notes || '')) {
      formData.append('notes', editedSubmission.notes || '');
      hasChanges = true;
    }
    if ((editedSubmission.link || '') !== (submission?.link || '')) {
      formData.append('link', editedSubmission.link || '');
      hasChanges = true;
    }
    if (newFile) {
      formData.append('file', newFile);
      hasChanges = true;
    }

    if (hasChanges) {
      onUpdate(submission.id, formData);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta entrega?')) {
      onDelete(submission.id);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedSubmission((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setNewFile(e.target.files?.[0] || null);
  };

  return (
    <div className="submission-item">
      <div className="submission-header">
        <img
          src={
            user.profile_picture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent((user.first_name || 'U') + ' ' + (user.last_name || ''))}`
          }
          alt="avatar"
          className="comment-avatar"
        />
        <div className="submission-user-info">
          <strong>{(user.first_name || 'Usuario') + ' ' + (user.last_name || '')}</strong>
          <span>
            {submission?.created_at ? format(parseISO(submission.created_at), 'dd MMM yyyy, HH:mm', { locale: es }) : 'Fecha desconocida'}
          </span>
        </div>
      </div>

      {isEditing ? (
        <div className="edit-submission-form">
          <label>Notas:</label>
          <textarea name="notes" value={editedSubmission.notes} onChange={handleInputChange} rows="3" />
          <label>Enlace:</label>
          <input type="url" name="link" value={editedSubmission.link} onChange={handleInputChange} />
          <label>Reemplazar archivo (opcional):</label>
          <input type="file" onChange={handleFileChange} />
          <div className="edit-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>
              <FiX /> Cancelar
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              <FiSave /> Guardar
            </button>
          </div>
        </div>
      ) : (
        <div className="submission-body">
          {submission?.notes && <p className="notes">&ldquo;{submission.notes}&rdquo;</p>}
          <div className="submission-links">
            {submission?.link && (
              <a href={submission.link} target="_blank" rel="noopener noreferrer" className="submission-link">
                <FiLink /> Ver enlace
              </a>
            )}
            {submission?.file && (
              <button className="btn btn-link" onClick={() => handleViewFile({ file_url: submission.file_url || submission.file })}>
                <FiPaperclip /> Ver archivo
              </button>
            )}
          </div>
        </div>
      )}

      {canEditOrDelete && !isEditing && (
        <div className="submission-actions">
          <button onClick={() => setIsEditing(true)} title="Editar">
            <FiEdit2 size={14} />
          </button>
          <button onClick={handleDelete} title="Eliminar">
            <FiTrash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

const EventItem = ({ event }) => {
  const eventDate = event?.start_time ? parseISO(event.start_time) : null;
  const formattedDate = eventDate ? format(eventDate, 'dd MMM yyyy, HH:mm', { locale: es }) : 'Fecha no definida';
  return (
    <div className="event-item" style={{ borderLeftColor: event?.color || '#3B82F6' }}>
      <div className="event-color-indicator" style={{ backgroundColor: event?.color || '#3B82F6' }} />
      <div className="event-content">
        <h4 className="event-title">{event?.title || 'Evento sin título'}</h4>
        <p className="event-date">{formattedDate}</p>
        {event?.description && <p className="event-description">{event.description}</p>}
      </div>
    </div>
  );
};

const MembersRenderer = ({ members, project, onMemberRemoved, currentUser }) => {
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const list = (members || []).filter(Boolean);

  const handleRemoveMember = async (memberId) => {
    setPendingRemoveId(memberId);
    toast(
      (t) => (
        <span>
          ¿Seguro que deseas eliminar este miembro del proyecto?
          <button
            className="btn btn-danger btn-sm"
            style={{ marginLeft: '10px' }}
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await removeProjectMember(project.id, memberId);
                toast.success('Miembro eliminado correctamente.');
                onMemberRemoved?.();
              } catch (error) {
                console.error('Error removing member:', error);
                toast.error('No se pudo eliminar el miembro.');
              } finally {
                setPendingRemoveId(null);
              }
            }}
          >
            Sí, eliminar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: '5px' }}
            onClick={() => {
              toast.dismiss(t.id);
              setPendingRemoveId(null);
            }}
          >
            Cancelar
          </button>
        </span>
      ),
      { duration: 8000 }
    );
  };

  if (list.length === 0) {
    return <p>No hay miembros para mostrar.</p>;
  }

  return (
    <>
      {list.map((member, i) => {
        const user = member?.user || {};
        const avatar =
          user.profile_picture ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent((user.first_name || 'Usuario') + ' ' + (user.last_name || 'Anónimo'))}&background=171717&color=fff`;
        return (
          <div key={user.id || `member-${i}`} className="member-item">
            <img src={avatar} alt={user.first_name || 'Usuario'} className="member-avatar" />
            <div className="member-info">
              <p className="member-name">
                {user.first_name || 'Nombre'} {user.last_name || 'Apellido'}
              </p>
              <span className="member-role">{member?.role ? member.role.replace('_', ' ') : 'Miembro'}</span>
            </div>
            {currentUser &&
              currentUser.role === 'SUPERADMIN' &&
              user.id !== project?.created_by && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginLeft: '10px' }}
                  onClick={() => handleRemoveMember(user.id)}
                  title="Eliminar miembro"
                  disabled={pendingRemoveId === user.id}
                >
                  Eliminar
                </button>
              )}
          </div>
        );
      })}
    </>
  );
};

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskFilter, setTaskFilter] = useState('ACTIVE');

  const { notifyProjectChange, notifyTaskChange, tasksUpdated, consumeTasksUpdate } = useProjectContext();
  const [commentText, setCommentText] = useState('');
  const [commentMentionIds, setCommentMentionIds] = useState([]);
  const [visibleComments, setVisibleComments] = useState(10);
  const { register: submissionRegister, handleSubmit: submissionHandleSubmit, reset: submissionReset } = useForm();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserFromSession,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Fetch project data
  const { 
    data: project, 
    isLoading: projectLoading,
    refetch: refetchProject 
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projectData = await getProjectById(projectId);
      
      const safeMembers = Array.isArray(projectData?.members) ? projectData.members.filter(Boolean) : [];
      return { ...projectData, members: safeMembers };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!projectId && projectId !== 'undefined' && !!currentUser,
  });

  // Fetch project tasks
  const { 
    data: tasks = [],
    isLoading: tasksLoading,
    refetch: refetchTasks 
  } = useQuery({
    queryKey: ['projectTasks', projectId],
    queryFn: async () => {
      const tasksData = await getTasks(projectId);
      
      const rawTasks = Array.isArray(tasksData?.results) 
        ? tasksData.results 
        : (Array.isArray(tasksData) ? tasksData : []);
        
      let safeTasks = (rawTasks || []).filter(Boolean);
      
      if (currentUser?.role === 'STUDENT') {
        safeTasks = safeTasks.filter((task) => {
          const isAssignedTo = task?.assigned_to?.id === currentUser?.id;
          
          const isInAssignedStudents = Array.isArray(task?.assigned_students_data) && 
            task.assigned_students_data.some(student => student.id === currentUser?.id);
            
          const isCreator = task?.created_by?.id === currentUser?.id || task?.created_by === currentUser?.id;

          return isAssignedTo || isInAssignedStudents || isCreator;
        });
      }
      
      return safeTasks;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!projectId && projectId !== 'undefined' && !!currentUser,
  });

  // Memoize task IDs for stable query key
  const taskIds = useMemo(() => 
    tasks?.map(t => t.id).sort().join(',') || '', 
    [tasks]
  );

  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    if (taskIdParam && tasks && tasks.length > 0) {
      const taskToOpen = tasks.find(t => String(t.id) === taskIdParam);
      if (taskToOpen && (!selectedTask || selectedTask.id !== taskToOpen.id)) {
        setSelectedTask(taskToOpen);
        
        // Remove taskId from URL so it doesn't persistently re-open on refresh
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('taskId');
        navigate({ search: newSearchParams.toString() }, { replace: true });
      }
    }
  }, [searchParams, tasks, selectedTask, navigate]);

  // Fetch task documents — ONE request per project instead of one per task (fixes N+1)
  const { data: taskDocuments = {} } = useQuery({
    queryKey: ['projectTaskDocuments', projectId, taskIds],
    queryFn: async () => {
      if (!tasks || tasks.length === 0) return {};
      const ids = tasks.map(t => t.id);
      return await getDocumentsByProject(projectId, ids);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tasks && tasks.length > 0 && !!projectId,
  });

  // Fetch project events
  const { data: projectEvents = [] } = useQuery({
    queryKey: ['projectEvents', projectId],
    queryFn: async () => {
      const eventsData = await getEventsByProject(projectId);
      const eventList = eventsData?.results || eventsData || [];
      const currentDate = new Date();
      
      const upcomingEvents = eventList
        .filter((event) => {
          const timeToCompare = event?.end_time || event?.start_time;
          if (!timeToCompare) return false;
          
          const eventEndDate = parseISO(timeToCompare);
          
          return !isAfter(currentDate, eventEndDate);
        })
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
      return upcomingEvents.slice(0, 3);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!projectId && projectId !== 'undefined',
  });

  const loading = projectLoading || tasksLoading;

  const fetchProjectData = useCallback(async () => {
    refetchProject();
    refetchTasks();
  }, [refetchProject, refetchTasks]);

  // Listen for task updates from other components
  useEffect(() => {
    if (tasksUpdated) {
      fetchProjectData();
      consumeTasksUpdate();
    }
  }, [tasksUpdated, fetchProjectData, consumeTasksUpdate]);

  // Listen for external task update events (keep for backward compatibility)
  useEffect(() => {
    const handleTaskChange = (e) => {
      if (!e.detail?.projectId || e.detail.projectId === parseInt(projectId)) {
        refetchProject();
        refetchTasks();
      }
    };
    window.addEventListener('tasksUpdated', handleTaskChange);
    return () => window.removeEventListener('tasksUpdated', handleTaskChange);
  }, [refetchProject, refetchTasks, projectId]);

  const handleDeleteProject = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await deleteProject(projectId);
      toast.success('Proyecto eliminado correctamente.');
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      const errorMessage = error.response?.data?.error || 'No se pudo eliminar el proyecto. Puede que tenga tareas o datos asociados.';
      toast.error(errorMessage);
    }
  };

  const handleUpdateComment = async (commentId, data) => {
    try {
      await updateProjectComment(projectId, commentId, data);
      queryClient.invalidateQueries(['project', projectId]);
      toast.success('Comentario actualizado.');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('No se pudo actualizar el comentario.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteProjectComment(projectId, commentId);
      queryClient.invalidateQueries(['project', projectId]);
      toast.success('Comentario eliminado.');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('No se pudo eliminar el comentario.');
    }
  };

  const handleUpdateSubmission = async (submissionId, data) => {
    try {
      await updateProjectSubmission(projectId, submissionId, data);
      queryClient.invalidateQueries(['project', projectId]);
      toast.success('Entrega actualizada correctamente.');
    } catch (error) {
      console.error('Error updating submission:', error?.response?.data || error);
      toast.error('No se pudo actualizar la entrega.');
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    try {
      await deleteProjectSubmission(projectId, submissionId);
      queryClient.invalidateQueries(['project', projectId]);
      toast.success('Entrega eliminada correctamente.');
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast.error('No se pudo eliminar la entrega.');
    }
  };

  const handleTaskCreated = (newTask, isEditMode = false) => {
    queryClient.invalidateQueries({ queryKey: ['projectTasks'] });
    queryClient.invalidateQueries({ queryKey: ['projectTaskDocuments'] });
    
    setIsModalOpen(false);
    notifyTaskChange(newTask.id, projectId, isEditMode ? 'update' : 'create');
    toast.success(isEditMode ? '¡Tarea actualizada!' : '¡Tarea creada exitosamente!');
  };

  const handleEditProject = () => setIsEditModalOpen(true);
  const handleCloseEditModal = () => setIsEditModalOpen(false);

  const handleProjectUpdated = () => {
    queryClient.invalidateQueries(['project', projectId]);
    setIsEditModalOpen(false);
    // Notify other components about the project change
    notifyProjectChange(projectId, 'update');
    toast.success('Proyecto actualizado correctamente.');
  };

  const handleAddMember = () => setIsAddMemberModalOpen(true);

  const handleMemberAdded = () => {
    queryClient.invalidateQueries(['project', projectId]);
    setIsAddMemberModalOpen(false);
  };

  const onProjectCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addProjectComment(projectId, {
        comment: commentText,
        mentioned_user_ids: commentMentionIds,
      });
      queryClient.invalidateQueries(['project', projectId]);
      setCommentText('');
      setCommentMentionIds([]);
      setVisibleComments(10);
      toast.success('Comentario añadido');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('No se pudo añadir el comentario.');
    }
  };

  const handleReplyComment = async (parentId, replyData) => {
    try {
      await addProjectComment(projectId, { ...replyData, parent_id: parentId });
      queryClient.invalidateQueries(['project', projectId]);
      toast.success('Respuesta enviada');
    } catch (error) {
      console.error('Error adding reply:', error);
      toast.error('No se pudo enviar la respuesta.');
      throw error;
    }
  };

  const onProjectSubmissionSubmit = async (data) => {
    const hasLink = data?.link && data.link.trim();
    const hasFile = data?.file && data.file.length > 0;
    if (!hasLink && !hasFile) {
      toast.error('Debes proporcionar un enlace o un archivo.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('notes', data?.notes || '');
      formData.append('link', data?.link || '');
      if (hasFile) formData.append('file', data.file[0]);
      await addProjectSubmission(projectId, formData);
      queryClient.invalidateQueries(['project', projectId]);
      submissionReset();
      toast.success('Entrega añadida con éxito');
    } catch (error) {
      console.error('Error adding submission:', error);
      toast.error('No se pudo añadir la entrega.');
    }
  };


  if (loading) return <Loading fullscreen text="Cargando proyecto..." />;

  if (!project || typeof project !== 'object') {
    return (
      <div className="empty-state" role="alert">
        <h2>Proyecto no encontrado</h2>
        <p>El proyecto que buscas no existe o no tienes permiso para verlo.</p>
        <Link to="/projects" className="btn btn-primary">
          Volver a Proyectos
        </Link>
      </div>
    );
  }

  const membersList = Array.isArray(project?.members) ? project.members.filter(Boolean) : [];

  // Members formatted for MentionInput: extract user from ProjectMember objects
  const mentionableMembers = membersList
    .map((m) => m?.user || m)
    .filter(Boolean)
    .filter((u) => u.id && u.username);

  const currentDate = new Date();
  const displayedTasks = tasks.filter(task => {
    const isOverdueTask = task.due_date && task.status !== 'COMPLETED' && isAfter(currentDate, parseISO(task.due_date));
    
    if (taskFilter === 'COMPLETED') {
      return task.status === 'COMPLETED';
    } else if (taskFilter === 'OVERDUE') {
      return isOverdueTask;
    } else {
      // ACTIVE view
      if (task.status === 'COMPLETED') return false;
      if (currentUser?.role === 'STUDENT' && isOverdueTask) return false;
      return true;
    }
  });

  return (
    <>
      <Helmet>
        <title>{project.name || 'Proyecto'} | Proyectos</title>
      </Helmet>

      {isModalOpen && (
        <Modal title="Nueva Tarea" onClose={() => setIsModalOpen(false)}>
          <TaskForm
            onCancel={() => setIsModalOpen(false)}
            onTaskSaved={handleTaskCreated}
            project={project}
            projectMembers={
              project.members?.map((member) => ({
                id: member?.user?.id || member?.id,
                first_name: member?.user?.first_name || member?.first_name,
                last_name: member?.user?.last_name || member?.last_name
              })) || []
            }
          />
        </Modal>
      )}

      {isAddMemberModalOpen && (
        <AddMemberModal isOpen={isAddMemberModalOpen} onClose={() => setIsAddMemberModalOpen(false)} projectId={projectId} onMemberAdded={handleMemberAdded} />
      )}

      {isEditModalOpen && (
        <Modal title="Editar Proyecto" onClose={handleCloseEditModal}>
          <ProjectForm project={project} onCancel={handleCloseEditModal} onProjectSaved={handleProjectUpdated} />
        </Modal>
      )}

      {selectedTask && (
        <Modal
          title={currentUser && currentUser.role === 'SUPERADMIN' ? 'Editar Tarea' : 'Detalles de la Tarea'}
          onClose={() => setSelectedTask(null)}
          size="large"
        >
          <TaskDetailsView
            task={selectedTask}
            user={currentUser}
            project={project}
            projectMembers={membersList}
            onClose={() => setSelectedTask(null)}
            documents={taskDocuments[selectedTask.id] || []}
            onDocumentUpload={() => {
              queryClient.invalidateQueries(['projectTaskDocuments', projectId]);
            }}
            onTaskUpdated={() => {
              queryClient.invalidateQueries(['projectTasks', projectId]);
              queryClient.invalidateQueries(['projectTaskDocuments', projectId]);
            }}
            onTaskDeleted={() => {
              queryClient.invalidateQueries(['projectTasks', projectId]);
              queryClient.invalidateQueries(['projectTaskDocuments', projectId]);
              setSelectedTask(null);
            }}
          />
        </Modal>
      )}

      <div className="project-detail-page animate-slide-up">
        <header className="page-header">
          <div>
            <span className={`status-badge status-${(project?.status || 'unknown').toLowerCase().replace(' ', '-')}`}>
              {project?.status ? translateStatus(project.status) : 'Desconocido'}
            </span>
            <h1 className="project-title-detail">{project?.name || 'Proyecto sin nombre'}</h1>
            <p className="project-description-detail">{project?.description || 'Sin descripción'}</p>
          </div>
          <div className="page-header-actions">
            {currentUser && currentUser.role === 'SUPERADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={handleEditProject}>
                  <FiEdit2 /> Editar
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={handleDeleteProject}
                  title="Eliminar proyecto"
                >
                  <FiTrash2 /> Eliminar
                </button>
              </>
            )}
          </div>
        </header>

        <div className={`project-layout-grid ${currentUser?.role === 'STUDENT' ? 'student-layout' : ''}`}>
          {/* Left column - Student Performance for analytics viewers */}
          {currentUser && canViewAnalytics(currentUser.role) && (
            <div className="main-column">
              <div className="glass-card">
                <StudentPerformance projectId={projectId} columnMode="left" />
              </div>
            </div>
          )}

          {/* Right column - Stats, Events, Members, and overflow student cards */}
          <div className="sidebar-column">
            {currentUser && currentUser.role !== 'CLIENT' && (
              <>
                {/* Project Progress Charts - Only for analytics viewers (not STUDENT) */}
                {canViewAnalytics(currentUser.role) && (
                  <ProjectProgressCharts projectId={projectId} />
                )}

                {/* Only show Events and Members in sidebar for non-STUDENT roles */}
                {currentUser.role !== 'STUDENT' && (
                  <>
                    {/* Events */}
                    <div className="glass-card">
                      <div className="section-header">
                        <h3>
                          <FiCalendar /> Próximos Eventos
                        </h3>
                      </div>
                      <div className="events-list">
                        {projectEvents && projectEvents.length > 0 ? (
                          projectEvents.map((event) => <EventItem key={event.id} event={event} />)
                        ) : (
                          <p className="no-events-message">No hay eventos próximos para este proyecto.</p>
                        )}
                      </div>
                    </div>

                    {/* Members */}
                    <div className="glass-card">
                      <div className="section-header">
                        <h3>Miembros ({membersList.length})</h3>
                        {currentUser && currentUser.role === 'SUPERADMIN' && (
                          <button className="btn btn-secondary btn-sm" onClick={handleAddMember}>
                            <FiPlus />
                          </button>
                        )}
                      </div>
                      <div className="member-list">
                        <MembersRenderer members={membersList} project={project} onMemberRemoved={fetchProjectData} currentUser={currentUser} />
                      </div>
                    </div>
                  </>
                )}
                
                {/* Continue student cards in right column */}
                {canViewAnalytics(currentUser.role) && (
                  <div className="glass-card">
                    <StudentPerformance projectId={projectId} columnMode="right" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Full-width content sections */}
        <div className="full-width-content">
          {/* Google Drive Folder - visible to admins and CLIENT */}
          {currentUser && canAccessDrive(currentUser.role) && (
            <div className="glass-card">
              <GoogleDriveFolder projectId={projectId} userRole={currentUser.role} />
            </div>
          )}

          {currentUser && currentUser.role !== 'CLIENT' && (
            <>
              {/* For STUDENT: Show Submissions first */}
              {currentUser.role === 'STUDENT' && (
                <div className="glass-card">
                  <div className="section-header">
                    <h2>
                      <FiUploadCloud /> Entregas Generales del Proyecto
                    </h2>
                  </div>
                  <div className="submissions-list">
                    {project?.submissions && project.submissions.length > 0 ? (
                      project.submissions.map((sub) => (
                        <ProjectSubmissionItem key={sub.id} submission={sub} currentUser={currentUser} onUpdate={handleUpdateSubmission} onDelete={handleDeleteSubmission} />
                      ))
                    ) : (
                      <p>No hay entregas generales para este proyecto.</p>
                    )}
                  </div>

                  {currentUser && canSubmit(currentUser.role) && (
                    <form onSubmit={submissionHandleSubmit(onProjectSubmissionSubmit)} className="submission-form">
                      <h4>Añadir nueva entrega</h4>
                      <textarea {...submissionRegister('notes')} placeholder="Añade notas..." rows="2" />
                      <input type="url" {...submissionRegister('link')} placeholder="Pega un enlace aquí..." />
                      <input type="file" {...submissionRegister('file')} />
                      <button type="submit" className="btn btn-primary">
                        <FiSend /> Enviar
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Tasks section */}
              <div className="glass-card">
                <div className="section-header">
                  <h2>
                    {currentUser?.role === 'STUDENT' ? 'Mis Tareas en este Proyecto' : `Tareas del Proyecto (${displayedTasks.length})`}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className={`btn btn-sm ${taskFilter === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'}`} 
                      onClick={() => setTaskFilter(taskFilter === 'COMPLETED' ? 'ACTIVE' : 'COMPLETED')}
                      title={taskFilter === 'COMPLETED' ? 'Ocultar tareas completadas' : 'Mostrar tareas completadas'}
                    >
                      <FiCheckSquare /> {taskFilter === 'COMPLETED' ? 'Ocultar' : 'Mostrar'} Completadas
                    </button>
                    <button 
                      className={`btn btn-sm ${taskFilter === 'OVERDUE' ? 'btn-danger' : 'btn-secondary'}`} 
                      onClick={() => setTaskFilter(taskFilter === 'OVERDUE' ? 'ACTIVE' : 'OVERDUE')}
                      title={taskFilter === 'OVERDUE' ? 'Ocultar tareas vencidas' : 'Mostrar tareas vencidas'}
                    >
                      <FiClock /> {taskFilter === 'OVERDUE' ? 'Ocultar' : 'Mostrar'} Vencidas
                    </button>
                    {currentUser && currentUser.role === 'SUPERADMIN' && (
                      <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
                        <FiPlus /> Nueva Tarea
                      </button>
                    )}
                  </div>
                </div>
                <div className="task-list">
                  {displayedTasks.length > 0 ? (
                    displayedTasks.map((task) => {
                      const assignee = task?.assigned_to || {};
                      const avatar =
                        assignee?.profile_picture ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent((assignee.first_name || 'Usuario') + ' ' + (assignee.last_name || ''))}&background=f97316&color=fff`;
                      const documents = taskDocuments[task.id] || [];

                      let uploadDateDisplay = null;
                      if (task.last_submission_date) {
                        uploadDateDisplay = format(parseISO(task.last_submission_date), 'dd MMM', { locale: es });
                      } else if (documents.length > 0) {
                        const latestDoc = [...documents].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
                        if (latestDoc && latestDoc.created_at) {
                          uploadDateDisplay = format(parseISO(latestDoc.created_at), 'dd MMM', { locale: es });
                        }
                      }

                      return (
                        <div key={task.id} className="task-item clickable" onClick={() => setSelectedTask(task)}>
                          <FiCheckSquare className={`task-status-icon status-${(task.status || 'pending').toLowerCase()}`} />
                          <div className="task-info">
                            <p className="task-title">{task.title || 'Tarea sin título'}</p>
                            {(documents.length > 0 || task.has_attachment || task.attachment || task.submissions_count > 0) && (
                              <div className="task-documents-badge">
                                <FiPaperclip size={12} />
                                <span>
                                  {task.submissions_count > 0 ? `${task.submissions_count} entrega(s)` : 
                                   documents.length > 0 ? `${documents.length} documento(s)` : 'Tiene adjunto'}
                                  {uploadDateDisplay ? ` el ${uploadDateDisplay}` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="task-right-section">
                            {task?.assigned_to && (
                              <img src={avatar} alt={assignee.first_name || 'Usuario'} className="task-assignee-avatar" title={`Asignada a ${assignee.first_name || ''}`} />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p>No hay tareas en esta vista para este proyecto todavía.</p>
                  )}
                </div>
              </div>

              {/* Comments section */}
              <div className="glass-card">
                <div className="section-header">
                  <h2>
                    <FiMessageSquare /> Comentarios del Proyecto
                  </h2>
                </div>
                <div className="comment-list">
                  {(() => {
                    const allComments = project?.comments || [];
                    const total = allComments.length;
                    const displayed = allComments.slice(Math.max(0, total - visibleComments));
                    const hasMore = visibleComments < total;
                    return (
                      <>
                        {hasMore && (
                          <button
                            className="btn btn-ghost btn-load-more-comments"
                            onClick={() => setVisibleComments(v => v + 10)}
                          >
                            Ver 10 comentarios anteriores ({total - visibleComments} restantes)
                          </button>
                        )}
                        {displayed.map((comment) => (
                          <ProjectCommentItem key={comment.id} comment={comment} currentUser={currentUser} onUpdate={handleUpdateComment} onDelete={handleDeleteComment} onReply={handleReplyComment} members={mentionableMembers} />
                        ))}
                        {total === 0 && <p>No hay comentarios todavía.</p>}
                      </>
                    );
                  })()}
                </div>

                <form onSubmit={onProjectCommentSubmit} className="comment-form">
                  <MentionInput
                    value={commentText}
                    onChange={setCommentText}
                    onMentionedUsersChange={setCommentMentionIds}
                    members={mentionableMembers}
                    rows={2}
                  />
                  <button type="submit" className="btn btn-primary" disabled={!commentText.trim()}>
                    <FiSend /> Enviar
                  </button>
                </form>
              </div>

              {/* For STUDENT: Show Events and Members at the bottom */}
              {currentUser.role === 'STUDENT' && (
                <>
                  {/* Events */}
                  <div className="glass-card">
                    <div className="section-header">
                      <h3>
                        <FiCalendar /> Próximos Eventos
                      </h3>
                    </div>
                    <div className="events-list">
                      {projectEvents && projectEvents.length > 0 ? (
                        projectEvents.map((event) => <EventItem key={event.id} event={event} />)
                      ) : (
                        <p className="no-events-message">No hay eventos próximos para este proyecto.</p>
                      )}
                    </div>
                  </div>

                  {/* Members */}
                  <div className="glass-card">
                    <div className="section-header">
                      <h3>Miembros ({membersList.length})</h3>
                    </div>
                    <div className="member-list">
                      <MembersRenderer members={membersList} project={project} onMemberRemoved={fetchProjectData} currentUser={currentUser} />
                    </div>
                  </div>
                </>
              )}

              {/* For non-STUDENT: Show Submissions at the end */}
              {currentUser.role !== 'STUDENT' && (
                <div className="glass-card">
                  <div className="section-header">
                    <h2>
                      <FiUploadCloud /> Entregas Generales del Proyecto
                    </h2>
                  </div>
                  <div className="submissions-list">
                    {project?.submissions && project.submissions.length > 0 ? (
                      project.submissions.map((sub) => (
                        <ProjectSubmissionItem key={sub.id} submission={sub} currentUser={currentUser} onUpdate={handleUpdateSubmission} onDelete={handleDeleteSubmission} />
                      ))
                    ) : (
                      <p>No hay entregas generales para este proyecto.</p>
                    )}
                  </div>

                  {currentUser && canSubmit(currentUser.role) && (
                    <form onSubmit={submissionHandleSubmit(onProjectSubmissionSubmit)} className="submission-form">
                      <h4>Añadir nueva entrega</h4>
                      <textarea {...submissionRegister('notes')} placeholder="Añade notas..." rows="2" />
                      <input type="url" {...submissionRegister('link')} placeholder="Pega un enlace aquí..." />
                      <input type="file" {...submissionRegister('file')} />
                      <button type="submit" className="btn btn-primary">
                        <FiSend /> Enviar
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ProjectDetailPage;