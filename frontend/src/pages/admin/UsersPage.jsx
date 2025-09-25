import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getUsers, deleteUser, activateUser } from '../../services/userService';
import Loading from '../../components/common/Loading';
import UserModal from '../../components/admin/UserModal';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import './AdminPages.scss';
import '../../assets/styles/_buttons.scss';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.results || response);
    } catch (error) {
      toast.error('No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
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

  const handleUserSaved = (savedUser, isEdit) => {
    if (isEdit) {
      setUsers(users.map(user => user.id === savedUser.id ? savedUser : user));
    } else {
      setUsers([savedUser, ...users]);
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

      <div className="admin-page animate-slide-up">
        <div className="page-header">
          <h1>Gestión de Usuarios</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <FiPlus /> Agregar Usuario
          </button>
        </div>

        <div className="glass-card">
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
                    <td>
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
                    <td>{user.email}</td>
                    <td><span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role.replace('_', ' ')}</span></td>
                    <td><span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>{user.is_active ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn edit" title="Editar" onClick={() => handleOpenModal(user)}>
                          <FiEdit />
                        </button>
                        <button
                          className="action-btn delete"
                          title="Eliminar"
                          onClick={() => handleDeleteUser(user.id)}
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
        </div>
      </div>
    </>
  );
};

export default UsersPage;