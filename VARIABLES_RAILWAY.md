# Variables de Entorno para Railway - Resumen Rápido

## 🔑 Variables Esenciales (Obligatorias)

### Django Core
```bash
SECRET_KEY=tu-secret-key-super-secreto-y-largo
DJANGO_SETTINGS_MODULE=config.settings.railway
DEBUG=False
```

### Base de Datos
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### URLs
```bash
BACKEND_URL=https://tu-backend.railway.app
FRONTEND_URL=https://tu-frontend.railway.app
ALLOWED_HOSTS=*.railway.app,*.up.railway.app,app.mhsolucionesempresariales.com
```

### Superusuario (para primera instalación)
```bash
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mhsoluciones.com
DJANGO_SUPERUSER_PASSWORD=ContraseñaSuperSegura123!
```

---

## 📧 Email (Gmail SMTP) - NUEVAS VARIABLES

### Configuración de Email
```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu-email@gmail.com
EMAIL_HOST_PASSWORD=xxxx-xxxx-xxxx-xxxx
DEFAULT_FROM_EMAIL=noreply@mhsoluciones.com
```

### 📝 Cómo obtener EMAIL_HOST_PASSWORD:

1. Ve a [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Habilita la verificación en dos pasos si no la tienes
3. Crea una contraseña de aplicación:
   - App: Correo
   - Dispositivo: Otro (MH Soluciones)
4. Copia la contraseña de 16 caracteres (ejemplo: `abcd efgh ijkl mnop`)
5. Pégala en `EMAIL_HOST_PASSWORD` sin espacios

---

## 🔴 Redis (para Celery y notificaciones)

```bash
REDIS_URL=${{Redis.REDIS_URL}}
```

**Nota:** Necesitas agregar un servicio Redis en Railway y vincularlo al backend.

---

## 📁 Google Drive Integration

```bash
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_DRIVE_ROOT_FOLDER_ID=tu-folder-id
```

---

## 🎯 Servicios Necesarios en Railway

### 1. Backend (Django)
- **Comando start:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
- **Variables:** Todas las de arriba

### 2. Frontend (React + Vite)
- **Comando start:** `npm run build && npm run preview`
- **Variables:** `VITE_API_URL=https://tu-backend.railway.app`

### 3. PostgreSQL
- **Servicio:** Railway PostgreSQL
- **Variables:** Auto-generadas

### 4. Redis
- **Servicio:** Railway Redis
- **Variables:** Auto-generadas

### 5. Celery Worker (Opcional, para procesar emails asíncronos)
- **Comando start:** `celery -A config worker --loglevel=info`
- **Variables:** Mismas que Backend

### 6. Celery Beat (Necesario para recordatorios automáticos)
- **Comando start:** `celery -A config beat --loglevel=info`
- **Variables:** Mismas que Backend

---

## 🔄 Orden de Despliegue Recomendado

1. **PostgreSQL** → Crear servicio
2. **Redis** → Crear servicio
3. **Backend** → Configurar todas las variables y desplegar
4. **Celery Worker** → (Opcional) Desplegar si quieres procesamiento asíncrono
5. **Celery Beat** → Desplegar para recordatorios automáticos de tareas
6. **Frontend** → Configurar `VITE_API_URL` y desplegar

---

## ✅ Checklist de Variables por Servicio

### Backend Django
- [ ] SECRET_KEY
- [ ] DJANGO_SETTINGS_MODULE
- [ ] DEBUG=False
- [ ] DATABASE_URL
- [ ] REDIS_URL
- [ ] BACKEND_URL
- [ ] FRONTEND_URL
- [ ] ALLOWED_HOSTS
- [ ] EMAIL_BACKEND
- [ ] EMAIL_HOST
- [ ] EMAIL_PORT
- [ ] EMAIL_USE_TLS
- [ ] EMAIL_HOST_USER
- [ ] EMAIL_HOST_PASSWORD
- [ ] DEFAULT_FROM_EMAIL
- [ ] GOOGLE_CLIENT_ID
- [ ] GOOGLE_CLIENT_SECRET
- [ ] GOOGLE_DRIVE_ROOT_FOLDER_ID
- [ ] DJANGO_SUPERUSER_USERNAME
- [ ] DJANGO_SUPERUSER_EMAIL
- [ ] DJANGO_SUPERUSER_PASSWORD

### Celery Worker
- [ ] Mismas variables que Backend

### Celery Beat
- [ ] Mismas variables que Backend

### Frontend
- [ ] VITE_API_URL

---

## 🧪 Testing de Email en Desarrollo

Para probar sin enviar emails reales, usa:

```bash
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

Esto imprimirá los emails en la consola del servidor en lugar de enviarlos.

---

## 📊 Monitoreo

Una vez desplegado, verifica:

1. **Backend logs:** Busca "Email sent successfully" para confirmar envíos
2. **Celery Beat logs:** Busca "send-task-due-reminders" para confirmar ejecución
3. **Redis:** Verifica conexión en logs del backend

---

## 🆘 Problemas Comunes

### Email no se envía
- ✅ Verifica EMAIL_HOST_PASSWORD (contraseña de aplicación, no contraseña normal)
- ✅ Verifica que EMAIL_USE_TLS=True
- ✅ Revisa logs del backend para errores específicos

### Celery Beat no ejecuta tareas
- ✅ Verifica que REDIS_URL esté configurado
- ✅ Asegúrate que el servicio Celery Beat esté corriendo
- ✅ Revisa logs de Celery Beat

### Base de datos no conecta
- ✅ Verifica que DATABASE_URL use la sintaxis ${{Postgres.DATABASE_URL}}
- ✅ Asegúrate que PostgreSQL esté desplegado y vinculado

---

**Archivo de referencia completo:** `env.railway.template`
