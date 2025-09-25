import api from './api';

export const getTasks = async (projectId = null) => {
  try {
    const url = projectId ? `/tasks/?project=${projectId}` : '/tasks/';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error.response?.data || new Error('Error al obtener tareas');
  }
};

export const getTaskDetails = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching task ${taskId} details:`, error);
    throw error.response?.data || new Error('Error al obtener detalles de la tarea');
  }
};

export const updateTask = async (taskId, taskData) => {
  try {
    const { data } = await api.patch(`/tasks/${taskId}/`, taskData);
    return data;
  } catch (error) {
    console.error(`Error al actualizar la tarea ${taskId}:`, error);
    throw error.response?.data || new Error('Error al actualizar la tarea');
  }
};

export const deleteTask = async (taskId) => {
  try {
    await api.delete(`/tasks/${taskId}/`);
  } catch (error) {
    console.error(`Error al eliminar la tarea ${taskId}:`, error);
    throw error.response?.data || new Error('Error al eliminar la tarea');
  }
};

export const createTask = async (taskData) => {
  try {
    const { data } = await api.post('/tasks/', taskData);
    return data;
  } catch (error) {
    throw error.response?.data || new Error('Error al crear la tarea');
  }
};

export const getTaskSubmissions = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/submissions/`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener entregas para la tarea ${taskId}:`, error);
    throw error.response?.data || new Error('Error al obtener entregas');
  }
};

export const addTaskSubmission = async (taskId, formData) => {
  try {
    const response = await api.post(`/tasks/${taskId}/submissions/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    console.error(`Error al subir la entrega para la tarea ${taskId}:`, error);
    throw error.response?.data || new Error('Error al subir la entrega');
  }
};

export const getTaskComments = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/comments/`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener comentarios de la tarea ${taskId}:`, error);
    throw error.response?.data || new Error('Error al obtener comentarios');
  }
};

export const addTaskComment = async (taskId, commentData) => {
  if (!taskId || typeof taskId !== 'number') {
    console.error('addTaskComment: taskId inválido', taskId);
    throw new Error('ID de tarea inválido');
  }

  if (!commentData || typeof commentData.comment !== 'string' || commentData.comment.trim() === '') {
    console.error('addTaskComment: comentario vacío o inválido', commentData);
    throw new Error('El comentario no puede estar vacío');
  }

  try {
    const response = await api.post(`/tasks/${taskId}/comments/`, commentData);
    console.info(`Comentario agregado a la tarea ${taskId}`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error al agregar comentario a la tarea ${taskId}:`, error);
    throw error.response?.data || new Error('Error al agregar comentario');
  }
};