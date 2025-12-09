import api from './api';

export const getEmployeeDocuments = async () => {
  try {
    const { data } = await api.get('hr/employee-documents/');
    return data;
  } catch (error) {
    throw error;
  }
};

export const getPerformanceReviews = async () => {
  try {
    const { data } = await api.get('hr/performance-reviews/');
    return data;
  } catch (error) {
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
    throw error;
  }
};

export const getEmployees = async () => {
  try {
    const { data } = await api.get('auth/users/');
    return data;
  } catch (error) {
    throw error;
  }
};

export const getEmployeeDocumentsByUser = async (userId) => {
  try {
    const { data } = await api.get(`hr/employee-documents/?employee=${userId}`);
    return data;
  } catch (error) {
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
    throw error;
  }
};

export const deleteEmployeeDocument = async (documentId) => {
  try {
    await api.delete(`hr/employee-documents/${documentId}/`);
  } catch (error) {
    throw error;
  }
};

export const createPerformanceReview = async (reviewData) => {
  try {
    const { data } = await api.post('hr/performance-reviews/', reviewData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const updatePerformanceReview = async (reviewId, reviewData) => {
  try {
    const { data } = await api.put(`hr/performance-reviews/${reviewId}/`, reviewData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const deletePerformanceReview = async (reviewId) => {
  try {
    await api.delete(`hr/performance-reviews/${reviewId}/`);
  } catch (error) {
    throw error;
  }
};

// Attendance services
export const getAttendances = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters);
    const { data } = await api.get(`hr/attendances/?${params.toString()}`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const getAttendancesByEmployee = async (employeeId) => {
  try {
    const { data } = await api.get(`hr/attendances/?employee=${employeeId}`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const createAttendance = async (attendanceData) => {
  try {
    const { data } = await api.post('hr/attendances/', attendanceData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const updateAttendance = async (attendanceId, attendanceData) => {
  try {
    const { data } = await api.put(`hr/attendances/${attendanceId}/`, attendanceData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const deleteAttendance = async (attendanceId) => {
  try {
    await api.delete(`hr/attendances/${attendanceId}/`);
  } catch (error) {
    throw error;
  }
};