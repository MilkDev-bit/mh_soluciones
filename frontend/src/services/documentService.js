import api from './api';

/**
 * Get all documents with optional filters
 * @param {Object} params - Query parameters (project, task, folder_type, etc.)
 * @returns {Promise<Array>} Array of documents
 */
export const getAllDocuments = async (params = {}) => {
  try {
    const response = await api.get('/documents/', { params });
    
    // Handle different response formats
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data && response.data.documents && Array.isArray(response.data.documents)) {
      return response.data.documents;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw new Error(
      error.response?.data?.message || 'Error al obtener documentos'
    );
  }
};

export const getDocumentsByTask = async (taskId) => {
  try {
    const response = await api.get(`/documents/?task=${taskId}`);
    const data = response.data;

    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data)) {
      return data;
    }
    if (data && data.documents && Array.isArray(data.documents)) {
      return data.documents;
    }
    
    return [];

  } catch (error) {
    return [];
  }
};

export const uploadDocument = async (formData) => {
  try {
    const response = await api.post('/documents/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    // Try alternative format only if the error is specifically about 'task' field
    const isTaskFieldError = error.response?.status === 400 && 
      error.response?.data?.task !== undefined;
    
    if (isTaskFieldError) {
      const newFormData = new FormData();
      for (let [key, value] of formData.entries()) {
        if (key !== 'task') {
          newFormData.append(key, value);
        }
      }

      const taskId = formData.get('task');
      if (taskId) {
        newFormData.append('task_id', parseInt(taskId, 10));
      }

      const response2 = await api.post('/documents/', newFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response2.data;
    }

    throw new Error(
      error.response?.data?.message || 'Error al subir el documento'
    );
  }
};

/**
 * Returns a usable URL for a file path.
 * Handles absolute URLs and relative media paths.
 */
export const getFileUrl = (filePath) => {
  if (!filePath) return null;
  
  // For any path (absolute URL or relative), return as-is
  // The proxy configuration handles media paths
  return filePath;
};

export const deleteDocument = async (documentId) => {
  try {
    await api.delete(`/documents/${documentId}/`);
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Error al eliminar el documento'
    );
  }
};

export const downloadDocument = async (documentId) => {
  try {
    const response = await api.get(`/documents/${documentId}/`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Error al descargar el documento'
    );
  }
};