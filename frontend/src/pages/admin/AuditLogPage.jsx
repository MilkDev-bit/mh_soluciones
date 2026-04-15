import { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { getAuditLog } from '../../services/auditLogService';
import { getUsers } from '../../services/userService';
import { FiShield, FiSearch, FiFilter, FiChevronLeft, FiChevronRight, FiUser, FiCalendar, FiActivity, FiRefreshCw } from 'react-icons/fi';
import './AuditLogPage.scss';

const PAGE_SIZE = 30;

const ACCIONES_LABELS = {
  TAREA_CREADA: 'Tarea Creada',
  TAREA_ACTUALIZADA: 'Tarea Editada',
  TAREA_COMPLETADA: 'Tarea Completada',
  TAREA_ELIMINADA: 'Tarea Eliminada',
  PROYECTO_CREADO: 'Proyecto Creado',
  PROYECTO_ACTUALIZADO: 'Proyecto Editado',
  PROYECTO_ELIMINADO: 'Proyecto Eliminado',
  MIEMBRO_REMOVIDO: 'Miembro Removido',
  MIEMBRO_AGREGADO: 'Miembro Agregado',
};

const ACCION_COLORES = {
  TAREA_CREADA: 'badge--green',
  TAREA_ACTUALIZADA: 'badge--blue',
  TAREA_COMPLETADA: 'badge--teal',
  TAREA_ELIMINADA: 'badge--red',
  PROYECTO_CREADO: 'badge--purple',
  PROYECTO_ACTUALIZADO: 'badge--orange',
  PROYECTO_ELIMINADO: 'badge--red',
  MIEMBRO_REMOVIDO: 'badge--red',
  MIEMBRO_AGREGADO: 'badge--green',
};

const formatDate = (isoString) => {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
};

const AuditLogPage = () => {
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({
    usuario_id: '',
    fecha_desde: '',
    fecha_hasta: '',
    accion: '',
    search: '',
  });
  const [pendingSearch, setPendingSearch] = useState('');

  const queryParams = useMemo(() => {
    const p = { limit: PAGE_SIZE, offset };
    if (filters.usuario_id) p.usuario_id = filters.usuario_id;
    if (filters.fecha_desde) p.fecha_desde = filters.fecha_desde;
    if (filters.fecha_hasta) p.fecha_hasta = filters.fecha_hasta;
    if (filters.accion) p.accion = filters.accion;
    if (filters.search) p.search = filters.search;
    return p;
  }, [filters, offset]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['audit-log', queryParams],
    queryFn: () => getAuditLog(queryParams),
    staleTime: 30 * 1000,
    keepPreviousData: true,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-list-audit'],
    queryFn: () => getUsers(1, '', 200),
    staleTime: 5 * 60 * 1000,
  });

  const users = useMemo(() => {
    const list = usersData?.results || usersData || [];
    return list.sort((a, b) => a.username.localeCompare(b.username));
  }, [usersData]);

  const logs = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handleFilterChange = useCallback((key, value) => {
    setOffset(0);
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    setOffset(0);
    setFilters(prev => ({ ...prev, search: pendingSearch }));
  }, [pendingSearch]);

  const handleClearFilters = useCallback(() => {
    setOffset(0);
    setPendingSearch('');
    setFilters({ usuario_id: '', fecha_desde: '', fecha_hasta: '', accion: '', search: '' });
  }, []);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <Helmet>
        <title>Auditoría de Actividad | MH Soluciones</title>
      </Helmet>

      <div className="audit-log-page">
        {/* Header */}
        <div className="audit-header">
          <div className="audit-header-icon">
            <FiShield />
          </div>
          <div className="audit-header-text">
            <h1>Auditoría de Actividad</h1>
            <p>Registro inmutable de acciones realizadas por los usuarios</p>
          </div>
          <button
            className="btn-refresh"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualizar"
          >
            <FiRefreshCw className={isFetching ? 'spinning' : ''} />
          </button>
        </div>

        {/* Filtros */}
        <div className="audit-filters">
          <form className="filter-search" onSubmit={handleSearchSubmit}>
            <FiSearch className="filter-icon" />
            <input
              type="text"
              placeholder="Buscar en descripción..."
              value={pendingSearch}
              onChange={e => setPendingSearch(e.target.value)}
            />
            <button type="submit" className="btn-apply-search">Buscar</button>
          </form>

          <div className="filter-group">
            <label><FiUser /> Usuario</label>
            <select
              value={filters.usuario_id}
              onChange={e => handleFilterChange('usuario_id', e.target.value)}
            >
              <option value="">Todos los usuarios</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name && u.last_name
                    ? `${u.first_name} ${u.last_name} (${u.username})`
                    : u.username}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label><FiActivity /> Acción</label>
            <select
              value={filters.accion}
              onChange={e => handleFilterChange('accion', e.target.value)}
            >
              <option value="">Todas las acciones</option>
              {Object.entries(ACCIONES_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label><FiCalendar /> Desde</label>
            <input
              type="date"
              value={filters.fecha_desde}
              onChange={e => handleFilterChange('fecha_desde', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label><FiCalendar /> Hasta</label>
            <input
              type="date"
              value={filters.fecha_hasta}
              onChange={e => handleFilterChange('fecha_hasta', e.target.value)}
            />
          </div>

          {hasActiveFilters && (
            <button className="btn-clear-filters" onClick={handleClearFilters}>
              <FiFilter /> Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="audit-table-wrapper">
          {isLoading ? (
            <div className="audit-loading">
              <div className="loading-spinner" />
              <span>Cargando registros...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="audit-empty">
              <FiActivity />
              <p>No se encontraron registros con los filtros aplicados.</p>
            </div>
          ) : (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Descripción</th>
                  <th>Proyecto ID</th>
                  <th>Tarea ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const actor = log.usuario
                    ? (log.usuario.first_name && log.usuario.last_name
                        ? `${log.usuario.first_name} ${log.usuario.last_name}`
                        : log.usuario.username)
                    : log.actor_username || 'Usuario eliminado';

                  return (
                    <tr key={log.id}>
                      <td className="col-date">{formatDate(log.created_at)}</td>
                      <td className="col-user">
                        <div className="user-cell">
                          <div className="user-avatar">
                            {actor.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="user-name">{actor}</span>
                            {log.usuario && (
                              <span className="user-role badge badge--role">
                                {log.usuario.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="col-action">
                        <span className={`badge ${ACCION_COLORES[log.accion] || 'badge--gray'}`}>
                          {log.accion_display || ACCIONES_LABELS[log.accion] || log.accion}
                        </span>
                      </td>
                      <td className="col-desc">{log.descripcion}</td>
                      <td className="col-id">{log.proyecto_id ?? '—'}</td>
                      <td className="col-id">{log.tarea_id ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {total > PAGE_SIZE && (
          <div className="audit-pagination">
            <span className="pagination-info">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total} registros
            </span>
            <div className="pagination-controls">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(prev => Math.max(0, prev - PAGE_SIZE))}
                aria-label="Página anterior"
              >
                <FiChevronLeft />
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(prev => prev + PAGE_SIZE)}
                aria-label="Página siguiente"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AuditLogPage;
