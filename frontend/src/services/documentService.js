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
    
    return [];

  } catch (error) {
    return [];
  }
};

export const uploadDocument = async (formData) => {
  try {
    try {
      const response = await api.post('/documents/', formData);
      return response.data;
    } catch (error) {
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

  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Error al subir el documento'
    );
  }
};

export const getFileUrl = (filePath) => {
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  if (filePath.startsWith('/media/') || filePath.startsWith('/static/')) {
    return `http://mh-soluciones-alb-nuevo-473372556.us-east-2.elb.amazonaws.com${filePath}`;
  }
  
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