import api from './api';

export const getProjects = async () => {
  try {
    const { data } = await api.get('projects/');
    return {
      ...data,
      results: Array.isArray(data.results) ? data.results : [],
    };
  } catch (error) {
    console.error("Error al obtener los proyectos:", error);
    return { results: [] };
  }
};

export const getProjectById = async (projectId) => {
  try {
    const { data } = await api.get(`projects/${projectId}/`);
    return data;
  } catch (error) {
    console.error(`Error al obtener el proyecto ${projectId}:`, error);
    throw error;
  }
};

export const createProject = async (projectData) => {
  try {
    const { data } = await api.post('projects/', projectData);
    return data;
  } catch (error) {
    console.error("Error al crear el proyecto:", error);
    throw error;
  }
};

export const updateProject = async (projectId, projectData) => {
  try {
    const { data } = await api.patch(`projects/${projectId}/`, projectData);
    return data;
  } catch (error) {
    console.error(`Error al actualizar el proyecto ${projectId}:`, error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    await api.delete(`projects/${projectId}/`);
    return true;
  } catch (error) {
    console.error(`Error al eliminar el proyecto ${projectId}:`, error);
    throw error.response?.data || new Error('Error al eliminar el proyecto');
  }
};

export const addProjectMembers = async (projectId, membersData) => {
  try {
    const { data } = await api.post(`projects/${projectId}/add-members/`, membersData);
    return data;
  } catch (error) {
    console.error(`Error al añadir miembros al proyecto ${projectId}:`, error);
    throw error;
  }
};

export const removeProjectMember = async (projectId, memberId) => {
  try {
    const { data } = await api.delete(`projects/${projectId}/remove-member/${memberId}/`);
    return data;
  } catch (error) {
    console.error("Error al eliminar miembro del proyecto:", error);
    throw error;
  }
};

export const getProjectMembers = async (projectId) => {
  try {
    const { data } = await api.get(`projects/${projectId}/`);
    
    console.log('Datos de miembros recibidos:', data.members);
    
    if (data.members && Array.isArray(data.members)) {
      return data.members.map(member => ({
        id: member.user?.id || member.id,
        first_name: member.user?.first_name || member.first_name || 'Usuario',
        last_name: member.user?.last_name || member.last_name || '',
        email: member.user?.email || member.email || ''
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error al obtener los miembros del proyecto ${projectId}:`, error);
    return [];
  }
};

export const addProjectComment = async (projectId, commentData) => {
  try {
    const response = await api.post(`/projects/${projectId}/comments/`, commentData);
    return response.data;
  } catch (error) {
    console.error('Error al agregar comentario al proyecto:', error);
    throw error.response?.data || new Error('Error al agregar comentario');
  }
};

export const addProjectSubmission = async (projectId, formData) => {
  try {
    const response = await api.post(`/projects/${projectId}/submissions/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al subir entrega al proyecto:', error);
    throw error.response?.data || new Error('Error al subir entrega');
  }
};

export const updateProjectComment = async (projectId, commentId, commentData) => {
  try {
    const response = await api.patch(`/projects/${projectId}/comments/${commentId}/`, commentData);
    return response.data;
  } catch (error) {
    console.error(`Error al actualizar el comentario ${commentId}:`, error);
    throw error.response?.data || new Error('Error al actualizar el comentario');
  }
};

export const deleteProjectComment = async (projectId, commentId) => {
  try {
    await api.delete(`/projects/${projectId}/comments/${commentId}/`);
    return true;
  } catch (error) {
    console.error(`Error al eliminar el comentario ${commentId}:`, error);
    throw error.response?.data || new Error('Error al eliminar el comentario');
  }
};


export const updateProjectSubmission = async (projectId, submissionId, formData) => {
  try {
    const response = await api.patch(`/projects/${projectId}/submissions/${submissionId}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error al actualizar la entrega ${submissionId}:`, error);
    throw error.response?.data || new Error('Error al actualizar la entrega');
  }
};

export const deleteProjectSubmission = async (projectId, submissionId) => {
  try {
    await api.delete(`/projects/${projectId}/submissions/${submissionId}/`);
    return true;
  } catch (error) {
    console.error(`Error al eliminar la entrega ${submissionId}:`, error);
    throw error.response?.data || new Error('Error al eliminar la entrega');
  }
};