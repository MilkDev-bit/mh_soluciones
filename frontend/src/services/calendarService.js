import api from './api';

export const getEventsByProject = async (projectId) => {
  if (!projectId) {
    return [];
  }
  try {
    const { data } = await api.get(`calendar/calendar-events/?project_id=${projectId}`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const getAvailableColors = async (projectId) => {
  if (!projectId) {
    return [];
  }
  try {
    const { data } = await api.get(`calendar/calendar-events/available-colors/?project_id=${projectId}`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const createEvent = async (eventData) => {
  try {
    const { data } = await api.post('calendar/calendar-events/', eventData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const updateEvent = async (eventId, eventData) => {
    try {
      const { data } = await api.patch(`calendar/calendar-events/${eventId}/`, eventData);
      return data;
    } catch (error) {
      throw error;
    }
};

export const deleteEvent = async (eventId) => {
  try {
    await api.delete(`calendar/calendar-events/${eventId}/`);
  } catch (error) {
    throw error;
  }
};