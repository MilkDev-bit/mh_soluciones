import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getUsers, deleteUser, activateUser } from '../../services/userService';
import Loading from '../../components/common/Loading';
import UserModal from '../../components/admin/UserModal';
import ChangePasswordModal from '../../components/admin/ChangePasswordModal';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiKey } from 'react-icons/fi';
import './AdminPages.scss';
import '../../assets/styles/_buttons.scss';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const usersPerPage = 20;

  const fetchUsers = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const response = await getUsers(page, search);
      setUsers(response.results || response);
      setTotalCount(response.count || (response.results || response).length);
      setTotalPages(response.count ? Math.ceil(response.count / usersPerPage) : 1);
      setCurrentPage(page);
    } catch (error) {
      toast.error('No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentPage, searchTerm);
  }, [currentPage, searchTerm]);

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
      const updatedUser = await activateUser(userId);
      setUsers(users.map(user => user.id === userId ? updatedUser : user));
      toast.success('Usuario activado correctamente.');
    } catch (error) {
      toast.error('No se pudo activar el usuario.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Seguro que deseas desactivar este usuario?')) return;
    try {
      await deleteUser(userId);
      setUsers(users.map(user => user.id === userId ? { ...user, is_active: false } : user));
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

  const handleUserSaved = (savedUser, isEdit) => {
    if (isEdit) {
      setUsers(users.map(user => user.id === savedUser.id ? savedUser : user));
    } else {
      fetchUsers(currentPage, searchTerm);
    }
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

  if (loading) {
    return <Loading fullscreen />;
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

      <div className="admin-page animate-slide-up">
        <div className="page-header">
          <h1>Gestión de Usuarios</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <FiPlus /> Agregar Usuario
          </button>
        </div>

        <div className="glass-card">
          <div className="search-section" style={{ marginBottom: '1.5rem' }}>
            <div className="search-input-container" style={{ position: 'relative', maxWidth: '400px' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }} />
              <input
                type="text"
                placeholder="Buscar por nombre, usuario o email..."
                value={searchTerm}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="modern-table">
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
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td data-label="Estado">
                      <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
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

          {totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', padding: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{ padding: '0.5rem 1rem' }}
              >
                Anterior
              </button>
              <span style={{ color: '#6c757d', fontSize: '0.95rem' }}>
                Página {currentPage} de {totalPages} ({totalCount} usuarios)
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{ padding: '0.5rem 1rem' }}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UsersPage;