import api from './api';

export const getProjects = async (page = null, search = '') => {
  try {
    let url = page ? `projects/?page=${page}` : 'projects/?all=true';
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const { data } = await api.get(url);
    
    // If backend returns a direct array (all=true), wrap it in paginated format 
    // to maintain backwards compatibility with components that expect .results
    if (Array.isArray(data)) {
      return {
        results: data,
        count: data.length,
        next: null,
        previous: null
      };
    }
    
    return {
      ...data,
      results: Array.isArray(data.results) ? data.results : [],
      count: data.count || 0,
      next: data.next,
      previous: data.previous
    };
  } catch (error) {
    return { results: [], count: 0, next: null, previous: null };
  }
};

export const getProjectById = async (projectId) => {
  try {
    const { data } = await api.get(`projects/${projectId}/`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const createProject = async (projectData) => {
  try {
    const { data } = await api.post('projects/', projectData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const updateProject = async (projectId, projectData) => {
  try {
    const { data } = await api.patch(`projects/${projectId}/`, projectData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    await api.delete(`projects/${projectId}/`);
    return true;
  } catch (error) {
    throw error.response?.data || new Error('Error al eliminar el proyecto');
  }
};

export const addProjectMembers = async (projectId, membersData) => {
  try {
    const { data } = await api.post(`projects/${projectId}/add-members/`, membersData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const removeProjectMember = async (projectId, memberId) => {
  try {
    const { data } = await api.delete(`projects/${projectId}/remove-member/${memberId}/`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const getProjectMembers = async (projectId) => {
  try {
    const { data } = await api.get(`projects/${projectId}/`);
    
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
    return [];
  }
};

export const addProjectComment = async (projectId, commentData) => {
  try {
    const response = await api.post(`/projects/${projectId}/comments/`, commentData);
    return response.data;
  } catch (error) {
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
    throw error.response?.data || new Error('Error al subir entrega');
  }
};

export const updateProjectComment = async (projectId, commentId, commentData) => {
  try {
    const response = await api.patch(`/projects/${projectId}/comments/${commentId}/`, commentData);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Error al actualizar el comentario');
  }
};

export const deleteProjectComment = async (projectId, commentId) => {
  try {
    await api.delete(`/projects/${projectId}/comments/${commentId}/`);
    return true;
  } catch (error) {
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
    throw error.response?.data || new Error('Error al actualizar la entrega');
  }
};

export const deleteProjectSubmission = async (projectId, submissionId) => {
  try {
    await api.delete(`/projects/${projectId}/submissions/${submissionId}/`);
    return true;
  } catch (error) {
    throw error.response?.data || new Error('Error al eliminar la entrega');
  }
};

export const getProjectProgressStats = async (projectId) => {
  try {
    const { data } = await api.get(`/projects/${projectId}/progress-stats/`);
    return data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener estadísticas del proyecto');
  }
};

export const getStudentPerformance = async (projectId) => {
  try {
    const { data } = await api.get(`/projects/${projectId}/student-performance/`);
    return data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener desempeño de estudiantes');
  }
};

export const getProjectDriveFolder = async (projectId, params = {}) => {
  try {
    const { data } = await api.get(`/projects/${projectId}/drive-folder/`, { params });
    return data;
  } catch (error) {
    throw error.response?.data || new Error('Error al obtener carpeta de Drive');
  }
};