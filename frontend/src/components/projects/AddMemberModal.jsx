import { useState, useEffect, useContext } from 'react';
import Modal from '../common/Modal';
import { getUsers } from '../../services/userService';
import { addProjectMembers } from '../../services/projectService';
import toast from 'react-hot-toast';
import { FiUserPlus, FiX, FiCheck, FiSearch } from 'react-icons/fi';
import './AddMemberModal.scss';
import { ProjectContext } from '../../contexts/ProjectContext';

const AddMemberModal = ({ isOpen, onClose, projectId, onMemberAdded }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { triggerProjectsUpdate } = useContext(ProjectContext);

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          setIsLoading(true);
          const allUsers = await getUsers();
          setUsers(allUsers.results || allUsers);
          setFilteredUsers(allUsers.results || allUsers);
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

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

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

      triggerProjectsUpdate();

      onMemberAdded();
      onClose();
      setSelectedUsers([]);
      setSearchTerm('');
    } catch (err) {
      toast.error('Error al añadir miembros al proyecto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSearchTerm('');
    onClose();
  };

  return (
    <Modal 
      title="Añadir Miembros" 
      onClose={handleClose}
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
            <p>Selecciona los usuarios que deseas añadir a este proyecto</p>
          </div>

          <div className="search-section">
            <div className="search-input-container">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Buscar usuarios por nombre o username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="member-form">
            <div className="form-group">
              <div className="users-section">
                {isLoading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <span>Cargando usuarios...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="empty-state">
                    <FiUserPlus />
                    <p>{searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios disponibles'}</p>
                    {searchTerm && (
                      <button 
                        type="button" 
                        className="clear-search-btn"
                        onClick={() => setSearchTerm('')}
                      >
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="users-header">
                      <span className="users-count">
                        {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} disponible{filteredUsers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="users-list">
                      {filteredUsers.map(user => (
                        <div
                          key={user.id}
                          className={`user-item ${selectedUsers.includes(user.id.toString()) ? 'selected' : ''}`}
                          onClick={() => handleSelectUser(user.id.toString())}
                        >
                          <div className="user-avatar">
                            <img
                              src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=4f46e5&color=fff`}
                              alt={`${user.first_name} ${user.last_name}`}
                              onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=4f46e5&color=fff`;
                              }}
                            />
                          </div>
                          <div className="user-info">
                            <h4 className="user-name">{user.first_name} {user.last_name}</h4>
                            <p className="user-username">@{user.username}</p>
                          </div>
                          <div className="selection-checkbox">
                            {selectedUsers.includes(user.id.toString()) && (
                              <div className="checkmark">
                                <FiCheck />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="selection-summary">
              <div className="selected-count">
                {selectedUsers.length} usuario{selectedUsers.length !== 1 ? 's' : ''} seleccionado{selectedUsers.length !== 1 ? 's' : ''}
              </div>
              {selectedUsers.length > 0 && (
                <button 
                  type="button" 
                  className="clear-selection-btn"
                  onClick={() => setSelectedUsers([])}
                >
                  Limpiar selección
                </button>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
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