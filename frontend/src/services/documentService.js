import api from './api';

export const getDocumentsByTask = async (taskId) => {
  try {
    const response = await api.get(`/documents/?task=${taskId}`);
    const data = response.data;

    console.log('Respuesta de API:', data);

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
    console.group('📤 Subida de documento');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }
    console.groupEnd();

    try {
      const response = await api.post('/documents/', formData);
      console.log('✅ Respuesta exitosa:', response.data);
      return response.data;
    } catch (error) {
      console.warn('⚠️ Endpoint normal falló, probando con task_id...');

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
      console.log('✅ Respuesta exitosa con task_id:', response2.data);
      return response2.data;
    }

  } catch (error) {
    console.error('❌ Error completo:', error);

    if (error.response) {
      console.error('Datos del error:', error.response.data);
      console.error('Status:', error.response.status);

      if (error.response.data && typeof error.response.data === 'object') {
        console.error(
          'Errores de validación:',
          JSON.stringify(error.response.data, null, 2)
        );
      }
    }

    throw new Error(
      error.response?.data?.message || 'Error al subir el documento'
    );
  }
};

export const getFileUrl = (filePath) => {
  let correctedUrl = filePath;
  
  if (filePath.includes('localhost:8000')) {
    correctedUrl = filePath.replace('localhost:8000', 'localhost:5173');
  } else if (filePath.includes('localhost/media/')) {
    correctedUrl = filePath.replace('localhost/', 'localhost:5173/');
  } else if (filePath.startsWith('/media/')) {
    correctedUrl = `http://localhost:5173${filePath}`;
  }
  return correctedUrl;
};

export const deleteDocument = async (documentId) => {
  try {
    await api.delete(`/documents/${documentId}/`);
    console.log(`🗑 Documento ${documentId} eliminado correctamente`);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error(
      error.response?.data?.message || 'Error al eliminar el documento'
    );
  }
};