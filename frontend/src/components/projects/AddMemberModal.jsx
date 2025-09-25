import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { getUsers } from '../../services/userService';
import { addProjectMembers } from '../../services/projectService';
import toast from 'react-hot-toast';
import { FiUserPlus, FiX, FiCheck } from 'react-icons/fi';
import './AddMemberModal.scss';

const AddMemberModal = ({ isOpen, onClose, projectId, onMemberAdded }) => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          setIsLoading(true);
          const allUsers = await getUsers();
          setUsers(allUsers.results || allUsers);
          setError('');
        } catch (err) {
          setError('No se pudo cargar la lista de usuarios.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchUsers();
    }
  }, [isOpen, projectId]);

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      toast.error('Debes seleccionar al menos un usuario.');
      return;
    }
    try {
      setIsLoading(true);
      await addProjectMembers(projectId, { user_ids: selectedUsers.map(id => parseInt(id)) });
      toast.success('¡Miembros añadidos correctamente!');
      onMemberAdded();
      onClose();
      setSelectedUsers([]);
    } catch (err) {
      toast.error('Error al añadir miembros al proyecto.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal 
      title="Añadir Miembros al Proyecto" 
      onClose={onClose}
      size="medium"
    >
      <div className="add-member-modal">
        {error && (
          <div className="error-message">
            <FiX />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-content">
          <div className="modal-description">
            <FiUserPlus />
            <p>Selecciona los usuarios que deseas añadir al proyecto</p>
          </div>

          <form onSubmit={handleSubmit} className="member-form">
            <div className="form-group">
              <label className="form-label">Usuarios disponibles</label>
              
              {isLoading ? (
                <div className="loading-users">
                  <div className="loading-spinner"></div>
                  <span>Cargando usuarios...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="empty-state">
                  <FiUserPlus />
                  <p>No hay usuarios disponibles</p>
                </div>
              ) : (
                <div className="users-list">
                  {users.map(user => (
                    <div
                      key={user.id}
                      className={`user-item ${selectedUsers.includes(user.id.toString()) ? 'selected' : ''}`}
                      onClick={() => handleSelectUser(user.id.toString())}
                    >
                      <div className="user-avatar">
                        <img
                          src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=4f46e5&color=fff`}
                          alt={`${user.first_name} ${user.last_name}`}
                        />
                        <div className="selection-indicator">
                          {selectedUsers.includes(user.id.toString()) && <FiCheck />}
                        </div>
                      </div>
                      <div className="user-info">
                        <h4 className="user-name">{user.first_name} {user.last_name}</h4>
                        <p className="user-username">@{user.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="selected-count">
              {selectedUsers.length} usuario{selectedUsers.length !== 1 ? 's' : ''} seleccionado{selectedUsers.length !== 1 ? 's' : ''}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || selectedUsers.length === 0}
              >
                {isLoading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Añadiendo...
                  </>
                ) : (
                  <>
                    <FiUserPlus />
                    Añadir miembros
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default AddMemberModal;