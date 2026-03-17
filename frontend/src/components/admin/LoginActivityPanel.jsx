import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiCheckCircle, FiXCircle, FiMonitor, FiGlobe, FiClock, FiShield, FiUnlock, FiAlertOctagon } from 'react-icons/fi';
import { getLoginActivity, getBlockedIPs, unblockIP } from '../../services/authService';
import { toast } from 'react-hot-toast';
import '../../pages/admin/UsersPage.scss';

const LoginActivityPanel = () => {
    const [activeTab, setActiveTab] = useState('history');
    const [currentPage, setCurrentPage] = useState(1);
    const queryClient = useQueryClient();

    const { data: activityData, isLoading: isLoadingHistory, isError: isErrorHistory } = useQuery({
        queryKey: ['loginActivity', currentPage],
        queryFn: () => getLoginActivity(currentPage),
        enabled: activeTab === 'history',
        staleTime: 60000,
    });

    const { data: blockedData, isLoading: isLoadingBlocked, isError: isErrorBlocked } = useQuery({
        queryKey: ['blockedIPs'],
        queryFn: getBlockedIPs,
        enabled: activeTab === 'blocked',
    });

    const unblockMutation = useMutation({
        mutationFn: unblockIP,
        onSuccess: () => {
            queryClient.invalidateQueries(['blockedIPs']);
            toast.success('IP desbloqueada correctamente');
        },
        onError: (error) => {
            console.error("Error unblocking:", error);
            toast.error('Error al desbloquear la IP');
        }
    });

    const activities = activityData?.results || activityData || [];
    const totalPages = activityData?.count ? Math.ceil(activityData.count / 20) : 1;

    const getTabStyle = (tabName) => ({
        cursor: 'pointer',
        fontSize: '1.1rem',
        margin: 0,
        padding: '10px 5px',
        fontWeight: activeTab === tabName ? '600' : '400',
        color: activeTab === tabName ? '#f05423' : '#6b7280',
        borderBottom: activeTab === tabName ? '3px solid #f05423' : '3px solid transparent',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });

    return (
        <div className="users-page" style={{ padding: '0' }}>
            <div className="users-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <h2 
                        onClick={() => setActiveTab('history')}
                        style={getTabStyle('history')}
                    >
                        <FiClock size={18} /> Historial de Accesos
                    </h2>
                    <h2 
                        onClick={() => setActiveTab('blocked')}
                        style={getTabStyle('blocked')}
                    >
                        <FiShield size={18} /> IPs Bloqueadas
                    </h2>
                </div>
            </div>

            <div className="users-table-container">
                {activeTab === 'history' && (
                    <>
                        {isLoadingHistory ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>Cargando historial...</div>
                        ) : isErrorHistory ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>Error al cargar el historial.</div>
                        ) : (
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
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FiClock style={{ color: '#9ca3af' }} />
                                                    {new Date(activity.timestamp).toLocaleString()}
                                                </div>
                                            </td>
                                            <td><strong>{activity.username}</strong></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FiGlobe style={{ color: '#9ca3af' }} />
                                                    {activity.ip_address}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FiMonitor style={{ color: '#9ca3af' }} />
                                                    {activity.user_agent?.split(' ')[0] || 'Web Browser'}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${activity.successful ? 'status-active' : 'status-inactive'}`}>
                                                    {activity.successful ? <FiCheckCircle /> : <FiXCircle />}
                                                    {activity.successful ? 'Exitoso' : 'Fallido'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {activities.length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No hay registros disponibles.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </>
                )}

                {activeTab === 'blocked' && (
                    <>
                        {isLoadingBlocked ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>Cargando lista negra...</div>
                        ) : isErrorBlocked ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>Error al obtener IPs bloqueadas.</div>
                        ) : (
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>Dirección IP</th>
                                        <th>Fecha Bloqueo</th>
                                        <th>Tiempo Transcurrido</th>
                                        <th>Razón</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(blockedData || []).map((block) => (
                                        <tr key={block.id}>
                                            <td><strong>{block.ip_address}</strong></td>
                                            <td>{new Date(block.created_at).toLocaleString()}</td>
                                            <td>{block.time_since_blocked}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                                                    <FiAlertOctagon /> {block.reason || 'Actividad sospechosa'}
                                                </div>
                                            </td>
                                            <td>
                                                <button 
                                                    className="action-btn"
                                                    disabled={unblockMutation.isLoading}
                                                    onClick={() => unblockMutation.mutate(block.id)}
                                                    style={{ 
                                                        background: '#ecfdf5', color: '#10b981', border: '1px solid #10b981', 
                                                        padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '5px'
                                                    }}
                                                >
                                                    <FiUnlock size={16} /> 
                                                    {unblockMutation.isLoading ? '...' : 'Desbloquear'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(blockedData || []).length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                                            <FiShield size={40} style={{ marginBottom: '10px', opacity: 0.3 }} /><br/>
                                            No hay IPs bloqueadas en este momento.
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>
            
            {activeTab === 'history' && totalPages > 1 && (
                <div className="pagination">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
                    <span>Página {currentPage} de {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</button>
                </div>
            )}
        </div>
    );
};

export default LoginActivityPanel;