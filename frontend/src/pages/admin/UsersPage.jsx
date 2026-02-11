import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUsers, deleteUser, activateUser } from '../../services/userService';
import UserModal from '../../components/admin/UserModal';
import ChangePasswordModal from '../../components/admin/ChangePasswordModal';
import UserCard from '../../components/admin/UserCard';
import UsersPageSkeleton from '../../components/admin/UsersPageSkeleton';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiKey, FiGrid, FiList, FiUsers, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { FaCrown, FaWrench, FaUserGraduate, FaChalkboardTeacher, FaUser } from 'react-icons/fa';
import './UsersPage.scss';
import '../../assets/styles/_buttons.scss';

const UsersPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const usersPerPage = 20;

  // Fetch users with React Query
  const { 
    data: usersData, 
    isLoading: loading,
    isError 
  } = useQuery({
    queryKey: ['users', currentPage, searchTerm],
    queryFn: () => getUsers(currentPage, searchTerm),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Handle errors
  if (isError) {
    toast.error('No se pudieron cargar los usuarios.');
  }

  const users = usersData?.results || usersData || [];
  const totalCount = usersData?.count || users.length;
  const totalPages = usersData?.count ? Math.ceil(usersData.count / usersPerPage) : 1;

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleOpenPasswordModal = (user) => {
    setEditingUser(user);
    setIsPasswordModalOpen(true);
  };

  const handleActivateUser = async (userId) => {
    try {
      await activateUser(userId);
      queryClient.invalidateQueries(['users']);
      toast.success('Usuario activado correctamente.');
    } catch (error) {
      toast.error('No se pudo activar el usuario.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Seguro que deseas desactivar este usuario?')) return;
    try {
      await deleteUser(userId);
      queryClient.invalidateQueries(['users']);
      toast.success('Usuario desactivado correctamente.');
    } catch (error) {
      toast.error('No se pudo desactivar el usuario.');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setEditingUser(null);
  };

  const handleUserSaved = () => {
    queryClient.invalidateQueries(['users']);
    handleCloseModal();
  };

  const handlePasswordChanged = () => {
    toast.success('Contraseña actualizada correctamente.');
    handleClosePasswordModal();
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const activeUsers = users.filter(u => u.is_active).length;
    const inactiveUsers = users.filter(u => !u.is_active).length;
    const activationRate = totalCount > 0 ? Math.round((activeUsers / totalCount) * 100) : 0;
    
    return {
      total: totalCount,
      active: activeUsers,
      inactive: inactiveUsers,
      activationRate
    };
  }, [users, totalCount]);

  if (loading) {
    return <UsersPageSkeleton viewMode={viewMode} />;
  }

  return (
    <>
      <Helmet>
        <title>Gestión de Usuarios | MH Soluciones</title>
      </Helmet>

      {isModalOpen && (
        <UserModal 
          onClose={handleCloseModal}
          onUserSaved={handleUserSaved}
          userToEdit={editingUser}
        />
      )}

      {isPasswordModalOpen && (
        <ChangePasswordModal
          onClose={handleClosePasswordModal}
          onPasswordChanged={handlePasswordChanged}
          user={editingUser}
        />
      )}

      <div className="users-page">
        {/* Header with Gradient and Stats */}
        <div className="users-header">
          <div className="users-header-top">
            <h1>Gestión de Usuarios</h1>
            <button className="btn-add-user" onClick={() => handleOpenModal()}>
              <FiPlus /> Agregar Usuario
            </button>
          </div>
          
          <div className="users-stats">
            <div className="stat-card">
              <div className="stat-icon">
                <FiUsers />
              </div>
              <div className="stat-content">
                <div className="stat-label">Total Usuarios</div>
                <div className="stat-value">{stats.total}</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <FiCheckCircle />
              </div>
              <div className="stat-content">
                <div className="stat-label">Activos</div>
                <div className="stat-value">{stats.active}</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <FiXCircle />
              </div>
              <div className="stat-content">
                <div className="stat-label">Inactivos</div>
                <div className="stat-value">{stats.inactive}</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <FiCheckCircle />
              </div>
              <div className="stat-content">
                <div className="stat-label">Tasa Activación</div>
                <div className="stat-value">{stats.activationRate}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and View Toggle */}
        <div className="view-controls">
          <div className="search-container">
            <FiSearch />
            <input
              type="text"
              placeholder="Buscar por nombre, usuario o email..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          
          <div className="view-toggle">
            <button 
              className={viewMode === 'grid' ? 'active' : ''} 
              onClick={() => setViewMode('grid')}
            >
              <FiGrid />
              <span>Grid</span>
            </button>
            <button 
              className={viewMode === 'table' ? 'active' : ''} 
              onClick={() => setViewMode('table')}
            >
              <FiList />
              <span>Tabla</span>
            </button>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="users-grid">
            {users.map(user => (
              <UserCard
                key={user.id}
                user={user}
                onEdit={handleOpenModal}
                onDelete={handleDeleteUser}
                onActivate={handleActivateUser}
                onChangePassword={handleOpenPasswordModal}
              />
            ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td data-label="Usuario">
                      <div className="user-cell">
                        <img 
                          src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f97316&color=fff`}
                          alt="Avatar" 
                          className="table-avatar"
                        />
                        <div>
                          <div className="user-cell-name">{user.first_name} {user.last_name}</div>
                          <div className="user-cell-username">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Rol">
                      <span className={`role-badge role-${user.role.toLowerCase()}`}>
                        {user.role === 'SUPERADMIN' && <FaCrown />}
                        {user.role === 'ADMIN' && <FaWrench />}
                        {user.role === 'STUDENT' && <FaUserGraduate />}
                        {user.role === 'PROFESSOR' && <FaChalkboardTeacher />}
                        {user.role === 'CLIENT' && <FaUser />}
                        <span>{user.role.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td data-label="Estado">
                      <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                        {user.is_active ? (
                          <>
                            <FiCheckCircle />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <FiXCircle />
                            <span>Inactivo</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <div className="action-buttons">
                        <button className="action-btn edit" title="Editar" onClick={() => handleOpenModal(user)}>
                          <FiEdit />
                        </button>
                        <button className="action-btn" title="Cambiar Contraseña" onClick={() => handleOpenPasswordModal(user)}>
                          <FiKey />
                        </button>
                        <button
                          className="action-btn delete"
                          title={user.is_active ? "Desactivar" : "Usuario Inactivo"}
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={!user.is_active}
                        >
                          <FiTrash2 />
                        </button>
                        {!user.is_active && (
                          <button
                            className="action-btn activate"
                            title="Activar"
                            onClick={() => handleActivateUser(user.id)}
                          >
                            <FiPlus />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <span>
              Página {currentPage} de {totalPages} ({totalCount} usuarios)
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
    </>
  );
};

export default UsersPage;