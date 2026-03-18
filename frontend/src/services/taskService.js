import api from './api';

export const getTasks = async (projectId = null, page = 1) => {
  try {
    let url = `/tasks/?page=${page}`;
    
    if (projectId && projectId !== 'all') {
      const cleanId = typeof projectId === 'object' ? projectId.id : projectId;
      
      if (cleanId && cleanId !== '[object Object]') {
        url = `/tasks/?project=${cleanId}&page=${page}&page_size=100`;
      }
    }

    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error("Error en getTasks:", error);
    throw error.response?.data || new Error('Error al obtener tareas');
  }
};

export const getMyTasks = async () => {
  try {
    const response = await api.get('/tasks/my-tasks/');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener mis tareas');
  }
};

export const getTaskDetails = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener detalles de la tarea');
  }
};

export const updateTask = async (taskId, taskData) => {
  try {
    const { data } = await api.patch(`/tasks/${taskId}/`, taskData);
    return data;
  } catch (error) {
    throw error.response?.data || new Error('Error al actualizar la tarea');
  }
};

export const deleteTask = async (taskId) => {
  try {
    await api.delete(`/tasks/${taskId}/`);
  } catch (error) {
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

export const reopenTask = async (taskId, reopenData) => {
  try {
    const { data } = await api.post(`/tasks/${taskId}/reopen/`, reopenData);
    return data;
  } catch (error) {
    throw error.response?.data || new Error('Error al reabrir la tarea');
  }
};

export const getTaskSubmissions = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/submissions/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener entregas');
  }
};

export const getSubmissionsByStudent = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/submissions/by-student/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener entregas por estudiante');
  }
};

export const addTaskSubmission = async (taskId, formData) => {
  try {
    const response = await api.post(`/tasks/${taskId}/submissions/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al subir la entrega');
  }
};

export const gradeSubmission = async (taskId, submissionId, gradeData) => {
  try {
    const response = await api.post(
      `/tasks/${taskId}/submissions/${submissionId}/grade/`,
      gradeData
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al calificar la entrega');
  }
};

export const getTaskComments = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/comments/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener comentarios');
  }
};

export const addTaskComment = async (taskId, commentData) => {
  if (!taskId || typeof taskId !== 'number') {
    throw new Error('ID de tarea inválido');
  }

  if (!commentData || typeof commentData.comment !== 'string' || commentData.comment.trim() === '') {
    throw new Error('El comentario no puede estar vacío');
  }

  try {
    const response = await api.post(`/tasks/${taskId}/comments/`, commentData);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al agregar comentario');
  }
};