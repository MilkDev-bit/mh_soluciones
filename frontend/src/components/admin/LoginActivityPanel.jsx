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

    const { data: activityData, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['loginActivity', currentPage],
        queryFn: () => getLoginActivity(currentPage),
        enabled: activeTab === 'history',
    });

    const { data: blockedData, isLoading: isLoadingBlocked } = useQuery({
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
        onError: () => toast.error('Error al desbloquear la IP')
    });

    const activities = activityData?.results || activityData || [];
    const totalPages = activityData?.count ? Math.ceil(activityData.count / 20) : 1;

    return (
        <div className="users-page" style={{ padding: '0' }}>
            <div className="users-header" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <h2 
                            onClick={() => setActiveTab('history')}
                            style={{ 
                                cursor: 'pointer', fontSize: '1.2rem', margin: 0,
                                color: activeTab === 'history' ? '#f05423' : '#6b7280',
                                borderBottom: activeTab === 'history' ? '2px solid #f05423' : 'none',
                                paddingBottom: '5px'
                            }}
                        >
                            Historial de Accesos
                        </h2>
                        <h2 
                            onClick={() => setActiveTab('blocked')}
                            style={{ 
                                cursor: 'pointer', fontSize: '1.2rem', margin: 0,
                                color: activeTab === 'blocked' ? '#f05423' : '#6b7280',
                                borderBottom: activeTab === 'blocked' ? '2px solid #f05423' : 'none',
                                paddingBottom: '5px'
                            }}
                        >
                            IPs Bloqueadas
                        </h2>
                    </div>
                </div>
            </div>

            <div className="users-table-container">
                {activeTab === 'history' ? (
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
                                    <td><div style={{display:'flex', alignItems:'center', gap:'5px'}}><FiClock/>{new Date(activity.timestamp).toLocaleString()}</div></td>
                                    <td><strong>{activity.username}</strong></td>
                                    <td><FiGlobe/> {activity.ip_address}</td>
                                    <td><FiMonitor/> {activity.user_agent?.split(' ')[0]}</td>
                                    <td>
                                        <span className={`status-badge ${activity.successful ? 'status-active' : 'status-inactive'}`}>
                                            {activity.successful ? <FiCheckCircle/> : <FiXCircle/>}
                                            {activity.successful ? 'Exitoso' : 'Fallido'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Dirección IP</th>
                                <th>Fecha Bloqueo</th>
                                <th>Intentos</th>
                                <th>Razón</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(blockedData || []).map((block) => (
                                <tr key={block.id}>
                                    <td><strong>{block.ip_address}</strong></td>
                                    <td>{new Date(block.blocked_at).toLocaleString()}</td>
                                    <td><span className="status-badge status-inactive">{block.attempts} intentos</span></td>
                                    <td><FiAlertOctagon style={{color: '#ef4444', marginRight: '5px'}}/> {block.reason || 'Fuerza bruta'}</td>
                                    <td>
                                        <button 
                                            className="action-btn edit" 
                                            onClick={() => unblockMutation.mutate(block.id)}
                                            title="Desbloquear IP"
                                            style={{ background: '#ecfdf5', color: '#10b981', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                                        >
                                            <FiUnlock size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {blockedData?.length === 0 && (
                                <tr><td colSpan="5" style={{textAlign:'center', padding:'2rem'}}>No hay IPs bloqueadas actualmente.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
            
            {activeTab === 'history' && totalPages > 1 && (
                <div className="pagination">
                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Anterior</button>
                    <span>Página {currentPage} de {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Siguiente</button>
                </div>
            )}
        </div>
    );
};

export default LoginActivityPanel;