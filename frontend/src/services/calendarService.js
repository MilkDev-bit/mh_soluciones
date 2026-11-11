import api from './api';

/**
 * Eventos de un proyecto, opcionalmente solo los que se traslapan con el
 * rango visible del calendario ({ start, end } como Date o ISO).
 * [FIX] Antes solo se leía la primera página (20 eventos): en proyectos con
 * más eventos el resto no aparecía en el calendario.
 */
export const getEventsByProject = async (projectId, range = {}) => {
  if (!projectId) {
    return [];
  }
  const params = new URLSearchParams({ project_id: projectId, page_size: '500' });
  const toIso = (v) => (v instanceof Date ? v.toISOString() : v);
  if (range.start) params.set('start_date', toIso(range.start));
  if (range.end) params.set('end_date', toIso(range.end));

  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    params.set('page', String(page));
    const { data } = await api.get(`calendar/calendar-events/?${params.toString()}`);
    const results = Array.isArray(data) ? data : (data?.results || []);
    all.push(...results);
    if (Array.isArray(data) || !data?.next || results.length === 0) break;
  }
  return all;
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