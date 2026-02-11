import { memo } from 'react';
import { FiEdit, FiTrash2, FiKey, FiCheckCircle } from 'react-icons/fi';
import { FaCrown, FaWrench, FaUserGraduate, FaChalkboardTeacher, FaUser } from 'react-icons/fa';

const UserCard = memo(({ user, onEdit, onDelete, onActivate, onChangePassword }) => {
  // Map roles to icons
  const roleIcons = {
    SUPERADMIN: <FaCrown />,
    ADMIN: <FaWrench />,
    STUDENT: <FaUserGraduate />,
    PROFESSOR: <FaChalkboardTeacher />,
    CLIENT: <FaUser />
  };

  // Map roles to colors
  const roleColors = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    STUDENT: 'student',
    PROFESSOR: 'professor',
    CLIENT: 'client'
  };

  return (
    <div className="user-card">
      <div className="user-card-header">
        <div className={`user-avatar-container avatar-border-${roleColors[user.role]}`}>
          <img 
            src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f97316&color=fff&size=128`}
            alt={`${user.first_name} ${user.last_name}`}
            className="user-avatar"
          />
        </div>
      </div>
      
      <div className="user-card-body">
        <h3 className="user-name">{user.first_name} {user.last_name}</h3>
        <p className="user-username">@{user.username}</p>
        <p className="user-email">{user.email}</p>
        
        <div className="user-badges">
          <span className={`role-badge-card role-${user.role.toLowerCase()}`}>
            {roleIcons[user.role]}
            <span>{user.role.replace('_', ' ')}</span>
          </span>
          
          <span className={`status-badge-card ${user.is_active ? 'status-active' : 'status-inactive'}`}>
            {user.is_active ? (
              <>
                <FiCheckCircle />
                <span>Activo</span>
              </>
            ) : (
              <>
                <span>Inactivo</span>
              </>
            )}
          </span>
        </div>
      </div>
      
      <div className="user-card-actions">
        <button 
          className="card-action-btn edit" 
          title="Editar usuario"
          onClick={() => onEdit(user)}
        >
          <FiEdit />
          <span>Editar</span>
        </button>
        
        <button 
          className="card-action-btn password" 
          title="Cambiar contraseña"
          onClick={() => onChangePassword(user)}
        >
          <FiKey />
          <span>Contraseña</span>
        </button>
        
        {user.is_active ? (
          <button 
            className="card-action-btn delete" 
            title="Desactivar usuario"
            onClick={() => onDelete(user.id)}
          >
            <FiTrash2 />
            <span>Desactivar</span>
          </button>
        ) : (
          <button 
            className="card-action-btn activate" 
            title="Activar usuario"
            onClick={() => onActivate(user.id)}
          >
            <FiCheckCircle />
            <span>Activar</span>
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if user data or handler functions actually changed
  return prevProps.user.id === nextProps.user.id &&
         prevProps.user.is_active === nextProps.user.is_active &&
         prevProps.user.updated_at === nextProps.user.updated_at;
});

UserCard.displayName = 'UserCard';

export default UserCard;
