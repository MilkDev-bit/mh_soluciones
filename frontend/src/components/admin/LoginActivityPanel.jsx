import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiCheckCircle, FiXCircle, FiMonitor, FiGlobe, FiClock, FiShield, FiUnlock, FiAlertOctagon } from 'react-icons/fi';
import { getLoginActivity, getBlockedIPs, unblockIP } from '../../services/authService';
import { toast } from 'react-hot-toast';
import '../../pages/admin/UsersPage.scss';

const LoginActivityPanel = () => {
    const [activeTab, setActiveTab] = useState('history');
    const [currentPage, setCurrentPage] = useState(1);
    const queryClient = useQueryClient();

    const { 
        data: activityData, 
        isLoading: isLoadingHistory, 
        isError: isErrorHistory 
    } = useQuery({
        queryKey: ['loginActivity', currentPage],
        queryFn: () => getLoginActivity(currentPage),
        enabled: activeTab === 'history',
    });

    const { 
        data: blockedData, 
        isLoading: isLoadingBlocked, 
        isError: isErrorBlocked 
    } = useQuery({
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

    const handleTabChange = useCallback((tab) => {
        console.log("Intentando cambiar a pestaña:", tab);
        setActiveTab(tab);
    }, []);

    const activities = activityData?.results || activityData || [];
    const totalPages = activityData?.count ? Math.ceil(activityData.count / 20) : 1;

    const getTabStyle = (tabName) => ({
        cursor: 'pointer',
        fontSize: '1.1rem',
        margin: 0,
        padding: '10px 15px',
        fontWeight: activeTab === tabName ? '600' : '400',
        color: activeTab === tabName ? '#f05423' : '#6b7280',
        borderBottom: activeTab === tabName ? '3px solid #f05423' : '3px solid transparent',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        outline: 'none',
        zIndex: 10
    });

    return (
        <div className="users-page" style={{ padding: '0', position: 'relative' }}>
            <div className="users-header" style={{ 
                marginBottom: '1.5rem', 
                borderBottom: '1px solid #e5e7eb',
                position: 'relative',
                zIndex: 20 
            }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        type="button"
                        onClick={() => handleTabChange('history')}
                        style={getTabStyle('history')}
                    >
                        <FiClock size={18} /> Historial de Accesos
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleTabChange('blocked')}
                        style={getTabStyle('blocked')}
                    >
                        <FiShield size={18} /> IPs Bloqueadas
                    </button>
                </div>
            </div>

            <div className="users-table-container" style={{ position: 'relative', zIndex: 5 }}>
                {activeTab === 'history' && (
                    <div className="fade-in">
                        {isLoadingHistory ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>Cargando historial...</div>
                        ) : isErrorHistory ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>Error en el servidor.</div>
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
                                            <td><FiGlobe /> {activity.ip_address}</td>
                                            <td><FiMonitor /> {activity.user_agent?.split(' ')[0] || 'Web'}</td>
                                            <td>
                                                <span className={`status-badge ${activity.successful ? 'status-active' : 'status-inactive'}`}>
                                                    {activity.successful ? <FiCheckCircle /> : <FiXCircle />}
                                                    {activity.successful ? 'Exitoso' : 'Fallido'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
                                <span>Página {currentPage} de {totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'blocked' && (
                    <div className="fade-in">
                        {isLoadingBlocked ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>Consultando lista negra...</div>
                        ) : isErrorBlocked ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>No se pudo conectar con el servicio de seguridad.</div>
                        ) : (
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>IP</th>
                                        <th>Bloqueo</th>
                                        <th>Tiempo</th>
                                        <th>Razón</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(blockedData || []).length > 0 ? (
                                        blockedData.map((block) => (
                                            <tr key={block.id}>
                                                <td><strong>{block.ip_address}</strong></td>
                                                <td>{new Date(block.created_at).toLocaleString()}</td>
                                                <td>{block.time_since_blocked}</td>
                                                <td style={{ color: '#ef4444' }}><FiAlertOctagon /> {block.reason}</td>
                                                <td>
                                                    <button 
                                                        className="action-btn"
                                                        onClick={() => unblockMutation.mutate(block.id)}
                                                        style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #10b981', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                        <FiUnlock /> Desbloquear
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                                                <FiShield size={30} style={{ opacity: 0.2 }} /><br/>
                                                Seguridad limpia. No hay IPs en la lista negra.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginActivityPanel;