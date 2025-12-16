# Matriz de Permisos por Rol - MH Soluciones

## Descripción General
Este documento define los permisos y accesos de cada rol en el sistema MH Soluciones.

## Roles del Sistema

### SUPERADMIN
**Acceso Completo al Sistema**
- ✅ Gestión completa de usuarios (crear, editar, eliminar, cambiar roles)
- ✅ Gestión completa de proyectos (crear, editar, eliminar, archivar)
- ✅ Gestión completa de tareas (crear, editar, eliminar, asignar)
- ✅ Acceso a todos los reportes y analíticas
- ✅ Gestión de calendarios y eventos
- ✅ Acceso a Google Drive folders
- ✅ Gestión de documentos
- ✅ Configuración del sistema
- ✅ Gestión de notificaciones
- ✅ Gestión de recursos humanos

### ADMIN
**Administración General**
- ✅ Gestión de usuarios (crear, editar - excepto SUPERADMIN)
- ✅ Gestión completa de proyectos
- ✅ Gestión completa de tareas
- ✅ Acceso a reportes y analíticas
- ✅ Gestión de calendarios y eventos
- ✅ Acceso a Google Drive folders
- ✅ Gestión de documentos
- ✅ Gestión de notificaciones
- ✅ Gestión de recursos humanos
- ❌ No puede eliminar SUPERADMIN
- ❌ No puede cambiar configuración del sistema

### CEO
**Liderazgo Ejecutivo**
- ✅ Visualización de todos los proyectos
- ✅ Gestión de proyectos (crear, editar)
- ✅ Gestión de tareas
- ✅ Acceso completo a reportes y analíticas
- ✅ Acceso a Google Drive folders
- ✅ Gestión de calendarios
- ✅ Visualización de recursos humanos
- ⚠️  Edición limitada de usuarios
- ❌ No puede eliminar proyectos
- ❌ No puede gestionar configuración del sistema

### RH (Recursos Humanos)
**Gestión de Personal**
- ✅ Gestión completa de usuarios (excepto SUPERADMIN y CEO)
- ✅ Visualización de todos los proyectos
- ✅ Gestión de tareas
- ✅ Acceso a reportes de rendimiento
- ✅ Acceso a Google Drive folders
- ✅ Gestión de calendarios
- ✅ Gestión completa de recursos humanos
- ⚠️  Edición limitada de proyectos
- ❌ No puede eliminar proyectos

### DIRECTOR
**Dirección de Proyectos**
- ✅ Gestión de proyectos asignados
- ✅ Gestión completa de tareas en sus proyectos
- ✅ Asignación de tareas a estudiantes
- ✅ Calificación de entregas
- ✅ Acceso a analíticas de sus proyectos
- ✅ Gestión de calendarios de sus proyectos
- ✅ Gestión de documentos de sus proyectos
- ⚠️  Solo visualiza usuarios de sus proyectos
- ❌ No puede crear/eliminar proyectos
- ❌ No accede a Google Drive folders
- ❌ No gestiona usuarios

### PROFESSOR (Profesor)
**Gestión Académica**
- ✅ Gestión de tareas en proyectos asignados
- ✅ Asignación de tareas a estudiantes
- ✅ Calificación de entregas de tareas
- ✅ Visualización de rendimiento de estudiantes
- ✅ Gestión de calendarios de sus proyectos
- ✅ Gestión de documentos de sus proyectos
- ✅ Creación de eventos en calendario
- ⚠️  Visualización limitada a sus proyectos
- ❌ No puede crear proyectos
- ❌ No puede gestionar usuarios
- ❌ No accede a Google Drive folders

### STUDENT (Estudiante)
**Participante en Proyectos**
- ✅ Visualización de proyectos asignados
- ✅ Visualización de tareas asignadas
- ✅ Entrega de tareas
- ✅ Visualización de calificaciones propias
- ✅ Visualización de calendario de sus proyectos
- ✅ Descarga de documentos de sus proyectos
- ✅ Visualización de notificaciones propias
- ❌ No puede crear proyectos
- ❌ No puede crear tareas
- ❌ No puede asignar tareas
- ❌ No puede calificar entregas
- ❌ No puede gestionar usuarios
- ❌ No accede a Google Drive folders
- ❌ No accede a analíticas generales

### CLIENT (Cliente)
**Visualización de Proyectos**
- ✅ Visualización de proyectos asignados
- ✅ Visualización de progreso de proyectos
- ✅ Visualización de entregas/documentos finales
- ✅ Acceso a Google Drive folders de sus proyectos
- ✅ Visualización de analíticas de sus proyectos
- ⚠️  Solo lectura de calendarios
- ❌ No puede crear/editar proyectos
- ❌ No puede crear/editar tareas
- ❌ No puede gestionar usuarios
- ❌ No puede subir documentos

## Matriz de Acceso por Módulo

### Gestión de Usuarios
| Rol | Ver | Crear | Editar | Eliminar | Cambiar Rol |
|-----|-----|-------|--------|----------|-------------|
| SUPERADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ (no SUPERADMIN) | ✅ (no SUPERADMIN) | ✅ (limitado) |
| CEO | ✅ (limitado) | ❌ | ⚠️ | ❌ | ❌ |
| RH | ✅ | ✅ | ✅ (no SUPERADMIN/CEO) | ✅ (no SUPERADMIN/CEO) | ⚠️ |
| DIRECTOR | ⚠️ (solo su equipo) | ❌ | ❌ | ❌ | ❌ |
| PROFESSOR | ⚠️ (solo estudiantes) | ❌ | ❌ | ❌ | ❌ |
| STUDENT | ❌ | ❌ | ❌ (solo perfil propio) | ❌ | ❌ |
| CLIENT | ❌ | ❌ | ❌ | ❌ | ❌ |

### Gestión de Proyectos
| Rol | Ver | Crear | Editar | Eliminar | Archivar |
|-----|-----|-------|--------|----------|----------|
| SUPERADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| CEO | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| RH | ✅ | ⚠️ | ⚠️ | ❌ | ❌ |
| DIRECTOR | ⚠️ (asignados) | ❌ | ⚠️ (asignados) | ❌ | ❌ |
| PROFESSOR | ⚠️ (asignados) | ❌ | ❌ | ❌ | ❌ |
| STUDENT | ⚠️ (asignados) | ❌ | ❌ | ❌ | ❌ |
| CLIENT | ⚠️ (asignados) | ❌ | ❌ | ❌ | ❌ |

### Gestión de Tareas
| Rol | Ver | Crear | Editar | Eliminar | Asignar | Calificar |
|-----|-----|-------|--------|----------|---------|-----------|
| SUPERADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CEO | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RH | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PROFESSOR | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| STUDENT | ⚠️ (asignadas) | ❌ | ❌ | ❌ | ❌ | ❌ |
| CLIENT | ⚠️ (del proyecto) | ❌ | ❌ | ❌ | ❌ | ❌ |

### Reportes y Analíticas
| Rol | Reportes Generales | Reportes de Proyecto | Rendimiento Individual | Exportar |
|-----|-------------------|---------------------|----------------------|----------|
| SUPERADMIN | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| CEO | ✅ | ✅ | ✅ | ✅ |
| RH | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ⚠️ | ⚠️ (sus proyectos) | ⚠️ (su equipo) | ⚠️ |
| PROFESSOR | ⚠️ | ⚠️ (sus proyectos) | ⚠️ (sus estudiantes) | ⚠️ |
| STUDENT | ❌ | ❌ | ⚠️ (solo propio) | ❌ |
| CLIENT | ⚠️ | ⚠️ (sus proyectos) | ❌ | ⚠️ |

## Implementación en Frontend

### Helper Functions (constants/roles.js)
```javascript
// Funciones existentes
export const isAdmin = (role) => ROLE_GROUPS.ADMIN_ROLES.includes(role);
export const canManageProjects = (role) => ROLE_GROUPS.PROJECT_MANAGERS.includes(role);
export const canViewAnalytics = (role) => ROLE_GROUPS.ANALYTICS_VIEWERS.includes(role);
export const canAccessDrive = (role) => ROLE_GROUPS.DRIVE_ACCESS.includes(role);
export const canSubmit = (role) => ROLE_GROUPS.SUBMITTERS.includes(role);

// Nuevas funciones necesarias
export const canManageUsers = (role) => ['SUPERADMIN', 'ADMIN', 'RH'].includes(role);
export const canCreateTasks = (role) => canManageProjects(role);
export const canGradeTasks = (role) => canManageProjects(role);
export const canViewReports = (role) => canViewAnalytics(role);
```

### Ocultamiento de Elementos UI

#### Botón de Gestión de Usuarios
```javascript
{isAdmin(user.role) && (
  <NavLink to="/admin/users">Gestión de Usuarios</NavLink>
)}
```

#### Botón de Nueva Tarea
```javascript
{canCreateTasks(user.role) && (
  <button onClick={handleCreateTask}>Nueva Tarea</button>
)}
```

#### Sección de Google Drive
```javascript
{canAccessDrive(user.role) && (
  <DriveAccessSection project={project} />
)}
```

## Última Actualización
Fecha: 2024-12-16
Versión: 1.0
