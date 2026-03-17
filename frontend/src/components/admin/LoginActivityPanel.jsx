import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiCheckCircle, FiXCircle, FiMonitor, FiGlobe, FiClock } from 'react-icons/fi';
import { getLoginActivity } from '../../services/authService';
import '../../pages/admin/UsersPage.scss'; 

const LoginActivityPanel = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20; 

    const { 
        data: activityData, 
        isLoading, 
        isError 
    } = useQuery({
        queryKey: ['loginActivity', currentPage],
        queryFn: () => getLoginActivity(currentPage),
        staleTime: 5 * 60 * 1000, 
        keepPreviousData: true, 
    });

    const activities = activityData?.results || activityData || [];
    const totalCount = activityData?.count || activities.length;
    const totalPages = activityData?.count ? Math.ceil(activityData.count / itemsPerPage) : 1;

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    if (isLoading && !activities.length) {
        return <div className="p-4 text-center">Cargando historial de accesos...</div>;
    }

    if (isError) {
        return <div className="p-4 text-center text-red-500">Error al cargar el historial.</div>;
    }

    return (
        <div className="users-page" style={{ padding: '0' }}> 
            <div className="users-header" style={{ marginBottom: '1.5rem' }}>
                <div className="users-header-top">
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Historial de Accesos</h2>
                </div>
            </div>

            <div className="users-table-container">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>Fecha y Hora</th>
                            <th>Usuario</th>
                            <th>IP</th>
                            <th>Dispositivo</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activities.map((activity) => (
                            <tr key={activity.id}>
                                <td data-label="Fecha y Hora">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FiClock style={{ color: '#9ca3af' }} />
                                        {new Date(activity.timestamp).toLocaleString('es-MX')}
                                    </div>
                                </td>
                                
                                <td data-label="Usuario">
                                    <div className="user-cell">
                                        <div>
                                            <div className="user-cell-name">
                                                {activity.first_name || activity.username}
                                            </div>
                                            <div className="user-cell-username">@{activity.username}</div>
                                        </div>
                                    </div>
                                </td>
                                
                                <td data-label="IP">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FiGlobe style={{ color: '#9ca3af' }} />
                                        {activity.ip_address}
                                    </div>
                                </td>
                                
                                <td data-label="Dispositivo" title={activity.user_agent}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FiMonitor style={{ color: '#9ca3af' }} />
                                        {activity.user_agent ? activity.user_agent.split(' ')[0] : 'Desconocido'}
                                    </div>
                                </td>
                                
                                <td data-label="Estado">
                                    <span className={`status-badge ${activity.successful ? 'status-active' : 'status-inactive'}`}>
                                        {activity.successful ? (
                                            <>
                                                <FiCheckCircle />
                                                <span>Exitoso</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiXCircle />
                                                <span>Fallido</span>
                                            </>
                                        )}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {activities.length === 0 && (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No hay registros de actividad disponibles.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        Anterior
                    </button>
                    <span>
                        Página {currentPage} de {totalPages} ({totalCount} registros)
                    </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    );
};

export default LoginActivityPanel;