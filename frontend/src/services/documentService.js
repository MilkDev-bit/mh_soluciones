import api from './api';

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
    
    console.warn('Estructura de respuesta inesperada:', data);
    return [];

  } catch (error) {
    console.error('Error al obtener documentos:', error);
    return [];
  }
};

export const uploadDocument = async (formData) => {
  try {
    const response = await api.post('/documents/', formData);
    return response.data;
  } catch (error) {
    // Try alternative format if first attempt fails
    if (error.response?.status === 400) {
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

    throw new Error(
      error.response?.data?.message || 'Error al subir el documento'
    );
  }
};

export const getFileUrl = (filePath) => {
  if (!filePath) return null;
  
  // If it's already a complete URL, return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  
  // For relative paths starting with /media/, use proxy
  if (filePath.startsWith('/media/')) {
    return filePath;
  }
  
  return filePath;
};

export const deleteDocument = async (documentId) => {
  try {
    await api.delete(`/documents/${documentId}/`);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error(
      error.response?.data?.message || 'Error al eliminar el documento'
    );
  }
};