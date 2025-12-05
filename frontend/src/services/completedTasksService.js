import api from './api';

export const getCompletedTasks = async (projectId = null) => {
  try {
    const params = { 
      status: 'COMPLETED',
      ...(projectId && { project: projectId })
    };
    const url = projectId 
      ? `/tasks/completed/?project=${projectId}`
      : '/tasks/completed/';
    
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getTaskCompletionStats = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}/completion-stats/`);
    return response.data;
  } catch (error) {
    throw error;
  }
};