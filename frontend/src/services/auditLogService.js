import api from './api';

/**
 * Obtiene el listado paginado del audit log.
 * @param {Object} params - Filtros y paginación
 * @param {number} [params.usuario_id]
 * @param {string} [params.fecha_desde]  - YYYY-MM-DD
 * @param {string} [params.fecha_hasta]  - YYYY-MM-DD
 * @param {string} [params.accion]
 * @param {string} [params.search]
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 */
export const getAuditLog = async (params = {}) => {
  const { data } = await api.get('core/audit-log/', { params });
  return data;
};
