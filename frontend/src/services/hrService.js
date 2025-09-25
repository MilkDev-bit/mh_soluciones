import api from './api';

export const getEmployeeDocuments = async () => {
  try {
    const { data } = await api.get('hr/employee-documents/');
    return data;
  } catch (error) {
    console.error("Error al obtener los documentos de empleados:", error);
    throw error;
  }
};

export const getPerformanceReviews = async () => {
  try {
    const { data } = await api.get('hr/performance-reviews/');
    return data;
  } catch (error) {
    console.error("Error al obtener las evaluaciones de desempeño:", error);
    throw error;
  }
};

export const createEmployeeDocument = async (formData) => {
  try {
    const { data } = await api.post('hr/employee-documents/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  } catch (error) {
    console.error("Error al crear el documento de empleado:", error);
    throw error;
  }
};

export const getEmployees = async () => {
  try {
    const { data } = await api.get('auth/users/');
    return data;
  } catch (error) {
    console.error("rror al obtener los empleados:", error);
    throw error;
  }
};

export const getEmployeeDocumentsByUser = async (userId) => {
  try {
    const { data } = await api.get(`hr/employee-documents/?employee=${userId}`);
    return data;
  } catch (error) {
    console.error("Error al obtener documentos del empleado:", error);
    throw error;
  }
};

export const downloadDocument = async (documentId) => {
  try {
    const response = await api.get(`hr/employee-documents/${documentId}/download/`, {
      responseType: 'blob'
    });
    return response;
  } catch (error) {
    console.error("Error al descargar el documento:", error);
    throw error;
  }
};

export const deleteEmployeeDocument = async (documentId) => {
  try {
    await api.delete(`hr/employee-documents/${documentId}/`);
  } catch (error) {
    console.error("Error al eliminar el documento:", error);
    throw error;
  }
};

export const createPerformanceReview = async (reviewData) => {
  try {
    const { data } = await api.post('hr/performance-reviews/', reviewData);
    return data;
  } catch (error) {
    console.error("Error al crear la evaluación:", error);
    throw error;
  }
};

export const updatePerformanceReview = async (reviewId, reviewData) => {
  try {
    const { data } = await api.put(`hr/performance-reviews/${reviewId}/`, reviewData);
    return data;
  } catch (error) {
    console.error("Error al actualizar la evaluación:", error);
    throw error;
  }
};

export const deletePerformanceReview = async (reviewId) => {
  try {
    await api.delete(`hr/performance-reviews/${reviewId}/`);
  } catch (error) {
    console.error("Error al eliminar la evaluación:", error);
    throw error;
  }
};