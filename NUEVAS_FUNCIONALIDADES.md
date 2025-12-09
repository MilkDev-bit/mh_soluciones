# Guía de Nuevas Funcionalidades - MH Soluciones

Este documento describe todas las nuevas funcionalidades implementadas y cómo configurarlas.

## 📋 Tabla de Contenidos

1. [Mejoras en la Gestión de Usuarios](#mejoras-en-la-gestión-de-usuarios)
2. [Sistema de Notificaciones por Email](#sistema-de-notificaciones-por-email)
3. [Variables de Entorno para Railway](#variables-de-entorno-para-railway)
4. [Modal de Agregar Miembros al Proyecto](#modal-de-agregar-miembros-al-proyecto)

---

## 1. Mejoras en la Gestión de Usuarios

### 🆕 Funcionalidades Implementadas

#### 1.1 Paginación de Usuarios
- La tabla de usuarios ahora muestra 20 usuarios por página
- Navegación entre páginas con botones "Anterior" y "Siguiente"
- Contador de total de usuarios

#### 1.2 Búsqueda de Usuarios
- Input de búsqueda en tiempo real
- Busca por:
  - Nombre de usuario (username)
  - Nombre (first_name)
  - Apellido (last_name)
  - Email
- La búsqueda es instantánea y actualiza los resultados automáticamente

#### 1.3 Edición de Usuarios
- Click en el botón de editar (ícono de lápiz) para modificar datos del usuario
- Campos editables:
  - Nombre de usuario
  - Nombre
  - Apellidos
  - Email
  - Rol

#### 1.4 Cambio de Contraseña
- Nuevo botón "Cambiar Contraseña" (ícono de llave) para cada usuario
- Los super administradores pueden cambiar la contraseña de cualquier usuario
- Validación:
  - Mínimo 8 caracteres
  - Las contraseñas deben coincidir
- Envío seguro a través del endpoint `/api/v1/auth/users/{id}/change-password/`

#### 1.5 Desactivación de Usuarios
- Botón de desactivar (ícono de basura) ahora funciona correctamente
- Los usuarios desactivados pueden ser reactivados con el botón "Activar" (ícono de plus)
- Los usuarios desactivados no pueden iniciar sesión
- Los usuarios desactivados se muestran con estado "Inactivo"

### 🔧 Endpoints de API

```
GET /api/v1/auth/users/?page=1&search=texto
POST /api/v1/auth/users/{id}/change-password/
DELETE /api/v1/auth/users/{id}/  (desactiva, no elimina)
PATCH /api/v1/auth/users/{id}/  (con is_active: true para activar)
```

---

## 2. Sistema de Notificaciones por Email

### 📧 Configuración de Gmail SMTP

#### 2.1 Crear Contraseña de Aplicación en Google

1. Accede a tu cuenta de Google
2. Ve a [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Si no has habilitado la verificación en dos pasos, hazlo primero
4. Crea una nueva contraseña de aplicación:
   - Selecciona "Correo" como aplicación
   - Selecciona "Otro" como dispositivo
   - Escribe "MH Soluciones"
5. Copia la contraseña de 16 caracteres generada

#### 2.2 Variables de Entorno Requeridas

Agrega estas variables en Railway Dashboard → Service → Variables:

```bash
# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu-email@gmail.com
EMAIL_HOST_PASSWORD=xxxx-xxxx-xxxx-xxxx  # Contraseña de aplicación de 16 caracteres
DEFAULT_FROM_EMAIL=noreply@mhsoluciones.com
```

### 📨 Tipos de Notificaciones

#### 2.1 Eventos de Calendario
Se envían automáticamente cuando:
- ✅ Se crea un nuevo evento
- ✅ Se actualiza un evento existente
- ✅ Se elimina un evento

**Destinatarios:** Todos los miembros del proyecto

**Contenido:**
- Título del evento
- Descripción
- Fecha y hora de inicio
- Fecha y hora de finalización
- Enlace al proyecto

#### 2.2 Asignación de Tareas
Se envían automáticamente cuando:
- ✅ Se asigna una tarea a un usuario
- ✅ Se asignan estudiantes a una tarea

**Destinatarios:** Usuario asignado y/o estudiantes asignados

**Contenido:**
- Título de la tarea
- Descripción
- Prioridad
- Estado
- Fecha de vencimiento
- Enlace a la tarea

#### 2.3 Recordatorios de Vencimiento
Se envían automáticamente vía Celery Beat:
- ⏰ 3 días antes del vencimiento
- ⏰ 1 día antes del vencimiento

**Destinatarios:** Usuarios asignados a la tarea

**Contenido:**
- Título de la tarea
- Descripción
- Prioridad
- Fecha de vencimiento
- Enlace a la tarea

**Configuración de Celery Beat:**
```python
# Ya configurado en config/settings/base.py
CELERY_BEAT_SCHEDULE = {
    'send-task-due-reminders': {
        'task': 'apps.tasks.tasks.send_task_due_reminders',
        'schedule': crontab(hour=8, minute=0),  # 8:00 AM diario
    },
}
```

#### 2.4 Tarea Reabierta
Se envían automáticamente cuando:
- ✅ Un profesor reabre una tarea cerrada

**Destinatarios:** 
- Estudiantes específicos (si se especifican)
- Todos los usuarios asignados (si no se especifican estudiantes específicos)

**Contenido:**
- Título de la tarea
- Nueva fecha límite
- Razón de reapertura
- Enlace a la tarea

#### 2.5 Tarea Devuelta para Revisión
Se envían automáticamente cuando:
- ✅ Un profesor califica una tarea con retroalimentación y puntuación baja
- ✅ La puntuación es menor al 70% de la puntuación máxima

**Destinatarios:** Estudiante que hizo la entrega

**Contenido:**
- Título de la tarea
- Retroalimentación del profesor
- Puntuación obtenida
- Enlace a la tarea

### 🎨 Plantillas de Email

Las plantillas se encuentran en:
```
backend/apps/core/templates/emails/
├── calendar_event_notification.html
├── calendar_event_notification.txt
├── task_assignment.html
├── task_assignment.txt
├── task_due_reminder.html
├── task_due_reminder.txt
├── task_reopened.html
├── task_reopened.txt
├── task_returned.html
└── task_returned.txt
```

Cada tipo de notificación tiene:
- **Versión HTML:** Con estilos profesionales y diseño responsive
- **Versión texto plano:** Para clientes de email que no soportan HTML

### 🔧 Funciones de Utilidad

En `backend/utils/email_notifications.py`:

```python
# Función genérica para enviar emails
send_email_notification(subject, recipient_list, template_name, context, html_template_name=None)

# Funciones específicas
send_calendar_event_notification(event, action='created')
send_task_assignment_notification(task)
send_task_due_reminder(task)
send_task_reopened_notification(task, reopen_log)
send_task_returned_notification(task, submission)
```

---

## 3. Variables de Entorno para Railway

### 📝 Lista Completa de Variables

Consulta el archivo `env.railway.template` para ver todas las variables de entorno necesarias. Las más importantes para las nuevas funcionalidades son:

#### Email Configuration
```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu-email@gmail.com
EMAIL_HOST_PASSWORD=xxxx-xxxx-xxxx-xxxx
DEFAULT_FROM_EMAIL=noreply@mhsoluciones.com
```

#### Redis para Celery (opcional, para recordatorios automáticos)
```bash
REDIS_URL=${{Redis.REDIS_URL}}
```

### 🚀 Despliegue en Railway

1. **Backend:**
   - El backend necesita Redis configurado para Celery Beat
   - Asegúrate de tener un servicio Redis en Railway
   - Vincula el servicio Redis al backend

2. **Celery Beat Worker:**
   - Necesitarás un servicio adicional para Celery Beat
   - Comando: `celery -A config beat --loglevel=info`
   - Variables de entorno: Las mismas que el backend

3. **Celery Worker (opcional):**
   - Para procesar tareas asíncronas
   - Comando: `celery -A config worker --loglevel=info`
   - Variables de entorno: Las mismas que el backend

### 📊 Arquitectura de Servicios en Railway

```
┌─────────────┐
│   Backend   │ ← Servicio principal Django
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌──────▼──────┐
│    Redis    │   │  PostgreSQL │
└──────┬──────┘   └─────────────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌──────▼──────┐
│Celery Worker│   │ Celery Beat │
└─────────────┘   └─────────────┘
```

---

## 4. Modal de Agregar Miembros al Proyecto

### ✅ Funcionalidad Existente (Ya Implementada)

El modal `AddMemberModal` ya cuenta con todas las funcionalidades solicitadas:

#### 4.1 Búsqueda por Nombre o Username
- Input de búsqueda en tiempo real
- Busca por:
  - Nombre (first_name)
  - Apellido (last_name)
  - Nombre de usuario (username)
- Resultados filtrados instantáneamente

#### 4.2 Selección con Checkboxes
- Cada usuario se puede seleccionar haciendo click en su tarjeta
- Checkbox visual con marca de verificación
- Múltiple selección permitida
- Contador de usuarios seleccionados

#### 4.3 Botón de Agregar
- Botón "Añadir miembros" para confirmar
- Validación: requiere al menos un usuario seleccionado
- Feedback visual durante el proceso
- Notificación de éxito/error

### 🎨 Características de UX

- **Diseño similar a Microsoft Teams:**
  - Lista de usuarios con avatares
  - Búsqueda prominente en la parte superior
  - Selección visual clara
  - Resumen de selección

- **Estados visuales:**
  - Usuario no seleccionado: fondo blanco
  - Usuario seleccionado: fondo azul con checkmark
  - Hover: efecto de resaltado

- **Accesibilidad:**
  - Click en cualquier parte de la tarjeta para seleccionar
  - Contador de usuarios disponibles
  - Contador de usuarios seleccionados
  - Botón para limpiar selección

### 📍 Ubicación del Componente

```
frontend/src/components/projects/AddMemberModal.jsx
frontend/src/components/projects/AddMemberModal.scss
```

---

## 📝 Notas Adicionales

### Seguridad
- Las contraseñas se envían hasheadas al backend
- Los emails se envían de forma asíncrona para no bloquear la aplicación
- Las notificaciones solo se envían a usuarios autorizados (miembros del proyecto)

### Rendimiento
- La paginación reduce la carga de la base de datos
- La búsqueda usa índices de base de datos (SearchFilter de DRF)
- Los emails se envían en segundo plano con Celery

### Mantenimiento
- Las plantillas de email son fáciles de personalizar
- Los recordatorios automáticos se pueden desactivar eliminando la tarea de Celery Beat
- Los logs están configurados para facilitar el debugging

### Testing
- Puedes probar los emails usando `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`
- Esto imprime los emails en la consola en lugar de enviarlos
- Útil para desarrollo y testing

---

## 🆘 Troubleshooting

### Los emails no se envían
1. Verifica que `EMAIL_BACKEND` esté configurado correctamente
2. Verifica que la contraseña de aplicación de Google sea correcta
3. Revisa los logs del backend para errores
4. Asegúrate de que los destinatarios tengan emails válidos

### Los recordatorios no se envían automáticamente
1. Verifica que Redis esté configurado y funcionando
2. Asegúrate de que Celery Beat esté corriendo
3. Revisa los logs de Celery Beat
4. Verifica que la tarea esté programada correctamente en `CELERY_BEAT_SCHEDULE`

### La búsqueda de usuarios no funciona
1. Verifica que el backend tenga `SearchFilter` configurado
2. Revisa la consola del navegador para errores
3. Asegúrate de que la API esté respondiendo correctamente

---

## 📚 Referencias

- [Django Email Documentation](https://docs.djangoproject.com/en/4.2/topics/email/)
- [Celery Beat Documentation](https://docs.celeryproject.org/en/stable/userguide/periodic-tasks.html)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Railway Documentation](https://docs.railway.app/)

---

**Desarrollado por:** MH Soluciones Team
**Fecha:** Diciembre 2024
**Versión:** 1.0
