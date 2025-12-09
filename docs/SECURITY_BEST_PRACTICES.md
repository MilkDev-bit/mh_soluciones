# Guía de Mejores Prácticas de Seguridad

## Resumen de Seguridad

Este documento describe las mejores prácticas de seguridad implementadas en el proyecto MH Soluciones para proteger datos sensibles y prevenir exposición de información confidencial.

## 1. Variables de Entorno

### ✅ Configuración Correcta

Todas las variables sensibles **DEBEN** ser configuradas a través de variables de entorno y **NUNCA** incluidas directamente en el código:

```python
# ✅ CORRECTO - Usar decouple.config()
from decouple import config

SECRET_KEY = config('SECRET_KEY')
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='')
GOOGLE_CLIENT_SECRET = config('GOOGLE_CLIENT_SECRET', default='')
```

```javascript
// ✅ CORRECTO - Usar import.meta.env en Vite
const API_URL = import.meta.env.VITE_API_BASE_URL || 'default-url';
```

### ❌ Configuración Incorrecta

```python
# ❌ INCORRECTO - NO hacer esto nunca
SECRET_KEY = 'mi-clave-secreta-123'
AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE'
```

## 2. Archivos de Configuración Segura

### Variables Sensibles Protegidas

Las siguientes variables están correctamente configuradas usando `decouple`:

#### Backend (Django)
- `SECRET_KEY` - Clave secreta de Django
- `AWS_ACCESS_KEY_ID` - Credenciales AWS S3
- `AWS_SECRET_ACCESS_KEY` - Credenciales AWS S3
- `GOOGLE_CLIENT_ID` - OAuth Google Drive
- `GOOGLE_CLIENT_SECRET` - OAuth Google Drive
- `DATABASE_URL` - URL de conexión a base de datos
- `REDIS_URL` - URL de conexión a Redis

#### Frontend (React/Vite)
- `VITE_API_BASE_URL` - URL base del API

### Archivos .gitignore

El archivo `.gitignore` debe incluir:

```
.env
.env.*
*.env
```

## 3. Logs y Console.log

### ✅ Implementado

Los logs sensibles están protegidos para no exponerse en producción:

```javascript
// Solo mostrar en modo desarrollo
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}
```

### Datos que NO deben aparecer en logs

- Tokens de autenticación
- Contraseñas
- Claves API
- Información personal identificable (PII)
- Datos de tarjetas de crédito

## 4. Seguridad en Producción

### Configuración HTTPS

```python
# En production.py y railway.py
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

### CORS Configuración

```python
# Solo permitir orígenes confiables
CORS_ALLOWED_ORIGINS = [
    "https://app.mhsolucionesempresariales.com",
    # Otros orígenes autorizados
]
```

## 5. Autenticación y Autorización

### JWT Tokens

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}
```

### Validación de IPs

El sistema incluye validación de IPs permitidas por usuario para mayor seguridad.

## 6. Almacenamiento de Archivos

### Configuración Segura S3

```python
# Solo se activa S3 si las credenciales están presentes
USE_S3_STORAGE = bool(
    AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and 
    AWS_ACCESS_KEY_ID.strip() and AWS_SECRET_ACCESS_KEY.strip()
)
```

## 7. Sistema de Notificaciones Seguro

### Optimización y Seguridad

- **Solo notificaciones no leídas**: Por defecto solo se cargan notificaciones sin leer
- **Límite de notificaciones**: Máximo 50 notificaciones para optimizar rendimiento
- **Filtrado por usuario**: Cada usuario solo puede ver sus propias notificaciones
- **Eliminación de notificaciones leídas**: Las notificaciones marcadas como leídas se eliminan de la vista

### Backend

```python
def get_queryset(self):
    queryset = self.request.user.notifications.all()
    
    # Solo mostrar notificaciones no leídas por defecto
    include_read = self.request.query_params.get('include_read', 'false').lower() == 'true'
    if not include_read:
        queryset = queryset.filter(is_read=False)
    
    # Limitar a las 50 más recientes
    limit = int(self.request.query_params.get('limit', 50))
    queryset = queryset[:limit]
    
    return queryset
```

### Frontend

```javascript
// Solo cargar notificaciones no leídas
const data = await notificationService.getNotifications({ include_read: false });

// Remover notificación de la lista al marcarla como leída
setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
```

## 8. Checklist de Seguridad Pre-Deployment

Antes de cada deployment, verificar:

- [ ] Todas las variables de entorno están configuradas
- [ ] No hay claves secretas en el código
- [ ] `.env` está en `.gitignore`
- [ ] HTTPS está habilitado en producción
- [ ] CORS está correctamente configurado
- [ ] Logs de desarrollo están deshabilitados en producción
- [ ] Tokens JWT tienen tiempo de expiración adecuado
- [ ] Credenciales AWS están protegidas
- [ ] DEBUG=False en producción

## 9. Respuesta a Incidentes

Si se detecta una exposición de credenciales:

1. **Inmediatamente** rotar todas las credenciales expuestas
2. Revisar logs para detectar uso no autorizado
3. Actualizar las variables de entorno en todos los entornos
4. Notificar al equipo de seguridad
5. Documentar el incidente

## 10. Recursos Adicionales

- [Django Security](https://docs.djangoproject.com/en/stable/topics/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Python Decouple](https://github.com/henriquebastos/python-decouple)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

**Última actualización**: 2025-12-09
**Mantenido por**: Equipo de Desarrollo MH Soluciones
