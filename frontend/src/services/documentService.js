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

/**
 * Get all documents for a project and group them by task ID.
 * Uses a single API call instead of one per task (fixes N+1 problem).
 * @param {number|string} projectId - The project ID
 * @param {Array} taskIds - Array of task IDs to include in the map
 * @returns {Promise<Object>} Map of { taskId: [documents] }
 */
export const getDocumentsByProject = async (projectId, taskIds = []) => {
  try {
    const response = await api.get('/documents/', { params: { project: projectId } });
    const data = response.data;

    let docs = [];
    if (data && Array.isArray(data.results)) {
      docs = data.results;
    } else if (Array.isArray(data)) {
      docs = data;
    } else if (data && data.documents && Array.isArray(data.documents)) {
      docs = data.documents;
    }

    // Build a map { taskId: [docs] } initialized with all known task IDs
    const map = {};
    taskIds.forEach(id => { map[id] = []; });
    docs.forEach(doc => {
      const tid = doc.task;
      if (tid !== null && tid !== undefined) {
        if (!map[tid]) map[tid] = [];
        map[tid].push(doc);
      }
    });
    return map;
  } catch (error) {
    console.error('Error fetching documents by project:', error);
    // Return empty map so the UI degrades gracefully
    const map = {};
    taskIds.forEach(id => { map[id] = []; });
    return map;
  }
};

export const uploadDocument = async (formData) => {
  try {
    // Let the browser set Content-Type with boundary automatically
    const response = await api.post('/documents/', formData);
    return response.data;
  } catch (error) {
    // Extract detailed error information
    const errorData = error.response?.data;
    
    // Try alternative format only if the error is specifically about 'task' field
    const isTaskFieldError = error.response?.status === 400 && 
      errorData?.task !== undefined;
    
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

      const response2 = await api.post('/documents/', newFormData);
      return response2.data;
    }

    // Create enhanced error with detailed message
    const errorMessage = errorData?.detail || errorData?.message || 'Error al subir el documento';
    const enhancedError = new Error(errorMessage);
    enhancedError.type = errorData?.error_type || 'upload_error';
    enhancedError.statusCode = error.response?.status;
    
    throw enhancedError;
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

/**
 * Download a document by ID
 * @param {number} documentId - The ID of the document to download
 * @returns {Promise<Blob>} The document file as a Blob
 * @throws {Error} If download fails
 */
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

/**
 * Get folders from Google Drive for a specific project
 * @param {number} projectId - The ID of the project
 * @returns {Promise<Array>} Array of folder objects from Google Drive
 * @throws {Error} If fetch fails
 */
export const getFoldersForProject = async (projectId) => {
  try {
    const response = await api.get('/documents/folders/', {
      params: { project: projectId }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching folders for project:', error);
    
    // Extract detailed error information from backend response
    const errorData = error.response?.data;
    const errorType = errorData?.error_type;
    const errorDetail = errorData?.detail || errorData?.error;
    
    // Create a more informative error with type
    const enhancedError = new Error(
      errorDetail || 'Error al obtener carpetas del proyecto'
    );
    enhancedError.type = errorType || 'unknown_error';
    enhancedError.statusCode = error.response?.status;
    
    throw enhancedError;
  }
};