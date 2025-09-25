import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
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
import { getDocumentsByTask } from '../../services/documentService';
import { getEventsByProject } from '../../services/calendarService';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import TaskForm from '../../components/tasks/TaskForm';
import TaskDetailsView from '../../components/tasks/TaskDetailsView';
import AddMemberModal from '../../components/projects/AddMemberModal';
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
  FiCalendar 
} from 'react-icons/fi';
import { format, parseISO, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import './ProjectDetailPage.scss';
import ProjectForm from '../../components/projects/ProjectForm';
import { translateStatus } from '../../utils/projectUtils';
import { handleViewFile } from '../../utils/fileUtils';

const ProjectCommentItem = ({ comment, currentUser, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(comment?.comment || '');

  const canEditOrDelete =
    currentUser?.id === comment?.user?.id ||
    ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(currentUser?.role);

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
          <p className="comment-text">{comment?.comment}</p>
        )}

        {canEditOrDelete && !isEditing && (
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
    ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(currentUser?.role);

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
          {submission?.notes && <p className="notes">"{submission.notes}"</p>}
          <div className="submission-links">
            {submission?.link && (
              <a href={submission.link} target="_blank" rel="noopener noreferrer" className="submission-link">
                <FiLink /> Ver enlace
              </a>
            )}
            {submission?.file && (
              <button className="btn btn-link" onClick={() => handleViewFile({ file_url: submission.file })}>
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
              ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(currentUser.role) &&
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
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDocuments, setTaskDocuments] = useState({});
  const [projectEvents, setProjectEvents] = useState([]);

  const { register: commentRegister, handleSubmit: commentHandleSubmit, reset: commentReset } = useForm();
  const { register: submissionRegister, handleSubmit: submissionHandleSubmit, reset: submissionReset } = useForm();

  const fetchProjectEvents = useCallback(async () => {
    if (!projectId) return;
    try {
      const eventsData = await getEventsByProject(projectId);
      const eventList = eventsData?.results || eventsData || [];
      const currentDate = new Date();
      const upcomingEvents = eventList
        .filter((event) => {
          if (!event?.start_time) return false;
          const eventDate = parseISO(event.start_time);
          return !isAfter(currentDate, eventDate);
        })
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      setProjectEvents(upcomingEvents.slice(0, 3));
    } catch (error) {
      console.error('Error fetching project events:', error);
    }
  }, [projectId]);

  const fetchProjectData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [projectData, userData] = await Promise.all([getProjectById(projectId), getCurrentUserFromSession()]);

      if (userData?.role === 'STUDENT') {
        const isMember = (projectData?.members || []).some(
          (m) => m?.user?.id === userData?.id || m?.id === userData?.id
        );
        if (!isMember) {
          toast.error('No tienes acceso a este proyecto.');
          setProject(null);
          setTasks([]);
          setLoading(false);
          return;
        }
      }

      const safeMembers = Array.isArray(projectData?.members) ? projectData.members.filter(Boolean) : [];
      setProject({ ...projectData, members: safeMembers });
      setCurrentUser(userData);

      const tasksData = await getTasks(projectId);
      const rawTasks = Array.isArray(tasksData?.results) ? tasksData.results : Array.isArray(tasksData) ? tasksData : [];
      let safeTasks = (rawTasks || []).filter(Boolean);
      if (userData?.role === 'STUDENT') {
        safeTasks = safeTasks.filter((task) => task?.assigned_to?.id === userData?.id);
      }
      setTasks(safeTasks);

      const documentsPromises = safeTasks.map(async (task) => {
        try {
          const documents = await getDocumentsByTask(task.id);
          return { taskId: task.id, documents };
        } catch (error) {
          console.error(`Error fetching documents for task ${task.id}:`, error);
          return { taskId: task.id, documents: [] };
        }
      });
      const documentsResults = await Promise.all(documentsPromises);
      const documentsMap = {};
      documentsResults.forEach((r) => {
        documentsMap[r.taskId] = r.documents;
      });
      setTaskDocuments(documentsMap);

      await fetchProjectEvents();
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('No se pudo cargar la información del proyecto.');
      setProject(null);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchProjectEvents]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleDeleteProject = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await deleteProject(projectId);
      toast.success('Proyecto eliminado correctamente.');
      navigate('/projects');
      fetchProjectData();
    } catch (error) {
      console.error('Error deleting project:', error);
      const errorMessage = error.response?.data?.error || 'No se pudo eliminar el proyecto. Puede que tenga tareas o datos asociados.';
      toast.error(errorMessage);
    }
  };

  const handleUpdateComment = async (commentId, data) => {
    try {
      const updatedComment = await updateProjectComment(projectId, commentId, data);
      setProject((prev) => ({
        ...prev,
        comments: (prev?.comments || []).map((c) => (c.id === commentId ? updatedComment : c))
      }));
      toast.success('Comentario actualizado.');
      fetchProjectData();
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('No se pudo actualizar el comentario.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteProjectComment(projectId, commentId);
      setProject((prev) => ({
        ...prev,
        comments: (prev?.comments || []).filter((c) => c.id !== commentId)
      }));
      toast.success('Comentario eliminado.');
      fetchProjectData();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('No se pudo eliminar el comentario.');
    }
  };

  const handleUpdateSubmission = async (submissionId, data) => {
    try {
      const updatedSubmission = await updateProjectSubmission(projectId, submissionId, data);
      setProject((prev) => ({
        ...prev,
        submissions: (prev?.submissions || []).map((s) => (s.id === submissionId ? updatedSubmission : s))
      }));
      toast.success('Entrega actualizada correctamente.');
      fetchProjectData();
    } catch (error) {
      console.error('Error updating submission:', error?.response?.data || error);
      toast.error('No se pudo actualizar la entrega.');
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    try {
      await deleteProjectSubmission(projectId, submissionId);
      setProject((prev) => ({
        ...prev,
        submissions: (prev?.submissions || []).filter((s) => s.id !== submissionId)
      }));
      toast.success('Entrega eliminada correctamente.');
      fetchProjectData();
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast.error('No se pudo eliminar la entrega.');
    }
  };

  const handleTaskCreated = (newTask, isEditMode = false) => {
    if (isEditMode) {
      setTasks((prev) => prev.map((t) => (t.id === newTask.id ? newTask : t)));
    } else {
      setTasks((prev) => [newTask, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleEditProject = () => setIsEditModalOpen(true);
  const handleCloseEditModal = () => setIsEditModalOpen(false);

  const handleProjectUpdated = (updatedProject) => {
    setProject((prev) => ({ ...prev, ...updatedProject }));
    setIsEditModalOpen(false);
    toast.success('Proyecto actualizado correctamente.');
    fetchProjectData();
  };

  const handleAddMember = () => setIsAddMemberModalOpen(true);

  const handleMemberAdded = () => {
    fetchProjectData();
    setIsAddMemberModalOpen(false);
  };

  const onProjectCommentSubmit = async (data) => {
    if (!data?.comment || !data.comment.trim()) return;
    try {
      const newCommentFromApi = await addProjectComment(projectId, { comment: data.comment });
      const newCommentWithUser = { ...newCommentFromApi, user: currentUser };
      setProject((prev) => ({ ...prev, comments: [...(prev?.comments || []), newCommentWithUser] }));
      commentReset();
      toast.success('Comentario añadido');
      fetchProjectData();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('No se pudo añadir el comentario.');
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
      const newSubmissionFromApi = await addProjectSubmission(projectId, formData);
      const newSubmissionWithUser = { ...newSubmissionFromApi, submitted_by: currentUser };
      setProject((prev) => ({ ...prev, submissions: [...(prev?.submissions || []), newSubmissionWithUser] }));
      submissionReset();
      toast.success('Entrega añadida con éxito');
      fetchProjectData();
    } catch (error) {
      console.error('Error adding submission:', error);
      toast.error('No se pudo añadir la entrega.');
    }
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

  if (loading) return <Loading fullscreen />;

  if (!project || typeof project !== 'object') {
    return (
      <div className="empty-state">
        <h2>Proyecto no encontrado</h2>
        <p>El proyecto que buscas no existe o no tienes permiso para verlo.</p>
        <Link to="/projects" className="btn btn-primary">
          Volver a Proyectos
        </Link>
      </div>
    );
  }

  const membersList = Array.isArray(project?.members) ? project.members.filter(Boolean) : [];

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
          title={currentUser && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(currentUser.role) ? 'Editar Tarea' : 'Detalles de la Tarea'}
          onClose={() => setSelectedTask(null)}
          size="large"
        >
          <TaskDetailsView
            task={selectedTask}
            user={currentUser}
            onClose={() => setSelectedTask(null)}
            documents={taskDocuments[selectedTask.id] || []}
            onDocumentUpload={() => {
              getDocumentsByTask(selectedTask.id)
                .then((docs) => {
                  setTaskDocuments((prev) => ({ ...prev, [selectedTask.id]: docs }));
                })
                .catch((error) => {
                  console.error('Error refreshing documents:', error);
                });
            }}
            onTaskUpdated={(updatedTask) => {
              if (updatedTask.status === 'COMPLETED') {
                setTasks((prev) => prev.filter((task) => task.id !== updatedTask.id));
              } else {
                setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
              }
            }}
            onTaskDeleted={(taskId) => {
              setTasks((prev) => prev.filter((t) => t.id !== taskId));
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
            {currentUser && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(currentUser.role) && (
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

        <div className="project-layout-grid">
          <div className="main-column">
            <div className="glass-card">
              <div className="section-header">
                <h2>
                  {currentUser?.role === 'STUDENT' ? 'Mis Tareas en este Proyecto' : `Tareas del Proyecto (${tasks.length})`}
                </h2>
                {currentUser && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(currentUser.role) && (
                  <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
                    <FiPlus /> Nueva Tarea
                  </button>
                )}
              </div>
              <div className="task-list">
                {tasks.length > 0 ? (
                  tasks.map((task) => {
                    const assignee = task?.assigned_to || {};
                    const avatar =
                      assignee?.profile_picture ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent((assignee.first_name || 'Usuario') + ' ' + (assignee.last_name || ''))}&background=f97316&color=fff`;
                    const documents = taskDocuments[task.id] || [];

                    return (
                      <div key={task.id} className="task-item clickable" onClick={() => setSelectedTask(task)}>
                        <FiCheckSquare className={`task-status-icon status-${(task.status || 'pending').toLowerCase()}`} />
                        <div className="task-info">
                          <p className="task-title">{task.title || 'Tarea sin título'}</p>
                          {task?.due_date && (
                            <span className="task-due-date">
                              Vence:{' '}
                              {format(parseISO(task.due_date), 'dd MMMM, yyyy', {
                                locale: es
                              })}
                            </span>
                          )}
                          {documents.length > 0 && (
                            <div className="task-documents-badge">
                              <FiPaperclip size={12} />
                              <span>{documents.length} documento(s)</span>
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
                  <p>No hay tareas en este proyecto todavía.</p>
                )}
              </div>
            </div>

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

              {currentUser && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'PROFESSOR', 'DIRECTOR'].includes(currentUser.role) && (
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

            <div className="glass-card">
              <div className="section-header">
                <h2>
                  <FiMessageSquare /> Comentarios del Proyecto
                </h2>
              </div>
              <div className="comment-list">
                {(project?.comments || []).map((comment) => (
                  <ProjectCommentItem key={comment.id} comment={comment} currentUser={currentUser} onUpdate={handleUpdateComment} onDelete={handleDeleteComment} />
                ))}
                {(project?.comments || []).length === 0 && <p>No hay comentarios todavía.</p>}
              </div>

              <form onSubmit={commentHandleSubmit(onProjectCommentSubmit)} className="comment-form">
                <textarea {...commentRegister('comment', { required: true })} placeholder="Escribe un comentario sobre el proyecto..." rows="2" />
                <button type="submit" className="btn btn-primary">
                  <FiSend /> Enviar
                </button>
              </form>
            </div>
          </div>

          <div className="sidebar-column">
            <div className="glass-card">
              <div className="section-header">
                <h3>Miembros ({membersList.length})</h3>
                {currentUser && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(currentUser.role) && (
                  <button className="btn btn-secondary btn-sm" onClick={handleAddMember}>
                    <FiPlus />
                  </button>
                )}
              </div>
              <div className="member-list">
                <MembersRenderer members={membersList} project={project} onMemberRemoved={fetchProjectData} currentUser={currentUser} />
              </div>
            </div>

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
          </div>
        </div>
      </div>
    </>
  );
};

export default ProjectDetailPage;