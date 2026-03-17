import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiCheckCircle, FiXCircle, FiMonitor, FiGlobe, FiClock, FiShield, FiUnlock, FiAlertOctagon, FiSearch } from 'react-icons/fi';
import { getLoginActivity, getBlockedIPs, unblockIP } from '../../services/authService';
import { toast } from 'react-hot-toast';
import '../../pages/admin/UsersPage.scss';

const LoginActivityPanel = () => {
    const [activeTab, setActiveTab] = useState('history');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemsPerPage] = useState(15);
    const [currentBlockedPage, setCurrentBlockedPage] = useState(1);
    const queryClient = useQueryClient();

    const { 
        data: activityData, 
        isLoading: isLoadingHistory 
    } = useQuery({
        queryKey: ['loginActivity', currentPage],
        queryFn: () => getLoginActivity(currentPage),
        enabled: activeTab === 'history',
        keepPreviousData: true,
    });

    const { 
        data: blockedData, 
        isLoading: isLoadingBlocked 
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
        onError: () => toast.error('Error al desbloquear la IP')
    });

    const filteredBlockedIPs = useMemo(() => {
        const data = Array.isArray(blockedData) ? blockedData : [];
        if (!searchTerm) return data;

        return data.filter(item => {
            const ip = item?.ip_address?.toLowerCase() || '';
            const reason = item?.reason?.toLowerCase() || '';
            const search = searchTerm.toLowerCase();
            return ip.includes(search) || reason.includes(search);
        });
    }, [blockedData, searchTerm]);

    const totalBlockedPages = Math.ceil(filteredBlockedIPs.length / itemsPerPage);
    const paginatedBlockedIPs = filteredBlockedIPs.slice(
        (currentBlockedPage - 1) * itemsPerPage,
        currentBlockedPage * itemsPerPage
    );

    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
        setSearchTerm('');
        setCurrentBlockedPage(1);
    }, []);

    const activities = activityData?.results || (Array.isArray(activityData) ? activityData : []);
    const totalHistoryPages = activityData?.count ? Math.ceil(activityData.count / 20) : 1;

    const getTabStyle = (tabName) => ({
        cursor: 'pointer',
        fontSize: '1.1rem',
        margin: 0,
        padding: '12px 20px',
        fontWeight: activeTab === tabName ? '600' : '400',
        color: activeTab === tabName ? '#f05423' : '#6b7280',
        borderBottom: activeTab === tabName ? '3px solid #f05423' : '3px solid transparent',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        border: 'none',
        outline: 'none',
        zIndex: 20
    });

    return (
        <div className="users-page" style={{ padding: '0', maxWidth: '100%', width: '100%' }}>
            <div className="users-header" style={{ 
                marginBottom: '1.5rem', 
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => handleTabChange('history')} style={getTabStyle('history')}>
                        <FiClock size={18} /> Historial
                    </button>
                    <button type="button" onClick={() => handleTabChange('blocked')} style={getTabStyle('blocked')}>
                        <FiShield size={18} /> IPs Bloqueadas
                    </button>
                </div>

                <div style={{ paddingBottom: '8px', position: 'relative', minWidth: '300px' }}>
                    <FiSearch style={{ position: 'absolute', left: '12px', top: '12px', color: '#9ca3af' }} />
                    <input 
                        type="text"
                        placeholder="Buscar IP o motivo..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentBlockedPage(1);
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 10px 10px 35px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            <div className="users-table-container" style={{ minHeight: '400px' }}>
                {activeTab === 'history' ? (
                    <div className="fade-in">
                        {isLoadingHistory ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>Cargando historial...</div>
                        ) : (
                            <>
                                <table className="users-table" style={{ width: '100%' }}>
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
                                                <td>{new Date(activity.timestamp).toLocaleString('es-MX')}</td>
                                                <td><strong>{activity.username}</strong></td>
                                                <td>{activity.ip_address}</td>
                                                <td>{activity.user_agent?.split(' ')[0] || 'Web'}</td>
                                                <td>
                                                    <span className={`status-badge ${activity.successful ? 'status-active' : 'status-inactive'}`}>
                                                        {activity.successful ? 'Exitoso' : 'Fallido'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {totalHistoryPages > 1 && (
                                    <div className="pagination">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
                                        <span>Página {currentPage} de {totalHistoryPages}</span>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalHistoryPages, p + 1))} disabled={currentPage === totalHistoryPages}>Siguiente</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <div className="fade-in">
                        {isLoadingBlocked ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>Consultando seguridad...</div>
                        ) : (
                            <>
                                <table className="users-table" style={{ width: '100%', fontSize: '1rem' }}>
                                    <thead>
                                        <tr style={{ height: '60px' }}>
                                            <th style={{ padding: '15px' }}>Dirección IP</th>
                                            <th>Fecha de Registro</th>
                                            <th>Tiempo Bloqueado</th>
                                            <th>Razón / Motivo</th>
                                            <th style={{ textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedBlockedIPs.length > 0 ? (
                                            paginatedBlockedIPs.map((block) => (
                                                <tr key={block.id || block.ip_address} style={{ height: '70px' }}>
                                                    <td style={{ padding: '15px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <FiGlobe color="#6b7280" />
                                                            <strong style={{ fontSize: '1.05rem' }}>{block.ip_address}</strong>
                                                        </div>
                                                    </td>
                                                    <td>{block.created_at ? new Date(block.created_at).toLocaleString('es-MX') : '---'}</td>
                                                    <td style={{ color: '#6b7280' }}>{block.time_since_blocked || 'Recién'}</td>
                                                    <td>
                                                        <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <FiAlertOctagon /> {block.reason || 'Sometido a revisión'}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button 
                                                            className="action-btn"
                                                            onClick={() => unblockMutation.mutate(block.id)}
                                                            disabled={unblockMutation.isLoading}
                                                            style={{ 
                                                                background: '#ecfdf5', color: '#10b981', border: '1px solid #10b981', 
                                                                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                                                fontWeight: '600', opacity: unblockMutation.isLoading ? 0.5 : 1
                                                            }}
                                                        >
                                                            <FiUnlock /> {unblockMutation.isLoading ? 'Liberando...' : 'Liberar IP'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '5rem' }}>
                                                    <FiShield size={50} style={{ opacity: 0.1, marginBottom: '15px' }} /><br/>
                                                    {searchTerm ? 'No hay coincidencias.' : 'Sin IPs bloqueadas.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {totalBlockedPages > 1 && (
                                    <div className="pagination" style={{ marginTop: '2rem' }}>
                                        <button onClick={() => setCurrentBlockedPage(p => Math.max(1, p - 1))} disabled={currentBlockedPage === 1}>Anterior</button>
                                        <span>Página {currentBlockedPage} de {totalBlockedPages}</span>
                                        <button onClick={() => setCurrentBlockedPage(p => Math.min(totalBlockedPages, p + 1))} disabled={currentBlockedPage === totalBlockedPages}>Siguiente</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginActivityPanel;