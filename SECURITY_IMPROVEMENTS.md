# Mejoras de Seguridad en Sistema de Autenticación

## Resumen
Este documento describe las mejoras de seguridad implementadas tanto en el frontend como en el backend del sistema MH Soluciones.

## Mejoras en Backend (Django)

### 1. Validadores de Contraseña Mejorados
**Ubicación:** `backend/apps/authentication/validators.py`

Se implementaron tres validadores personalizados:

#### StrongPasswordValidator
- Requiere mínimo 12 caracteres
- Al menos una letra mayúscula
- Al menos una letra minúscula
- Al menos un número
- Al menos un carácter especial (!@#$%^&*, etc.)

#### CompromisedPasswordValidator
- Verifica contraseñas en lista de contraseñas comprometidas comunes
- Detecta patrones simples (caracteres repetidos)

#### PasswordExpiryValidator
- Las contraseñas expiran después de 90 días
- Fuerza el cambio de contraseña cuando expira

### 2. Bloqueo de Cuenta por Intentos Fallidos
**Ubicación:** `backend/apps/authentication/models.py`

Nuevos campos en el modelo CustomUser:
- `failed_login_attempts`: Contador de intentos fallidos
- `account_locked_until`: Timestamp de bloqueo de cuenta
- `password_changed_at`: Fecha del último cambio de contraseña
- `force_password_change`: Bandera para forzar cambio

**Comportamiento:**
- Después de 5 intentos fallidos, la cuenta se bloquea por 30 minutos
- El contador se resetea al tener un login exitoso
- El sistema verifica automáticamente si el bloqueo ha expirado

### 3. Rate Limiting
**Ubicación:** `backend/apps/authentication/api/views.py`

- Implementado con `django-ratelimit`
- Límite de 5 intentos de login por minuto por IP
- Protege contra ataques de fuerza bruta

### 4. Encriptación de Datos Sensibles
**Ubicación:** `backend/apps/authentication/models.py`

- Campo personalizado `EncryptedCharField` para datos sensibles
- Usa `cryptography.fernet` para encriptación AES
- Tokens de Google OAuth2 se almacenan encriptados
- La encriptación/desencriptación es transparente

### 5. Middleware de Seguridad
**Ubicación:** `backend/apps/authentication/security_middleware.py`

#### SessionSecurityMiddleware
- Rastrea actividad del usuario
- Auto-logout después de 15 minutos de inactividad
- Actualiza timestamp de última actividad en cada request

#### PasswordExpiryMiddleware
- Verifica si la contraseña ha expirado (90 días)
- Bloquea acceso hasta que se cambie la contraseña
- Permite acceso solo al endpoint de cambio de contraseña

### 6. Headers de Seguridad HTTP
**Ubicación:** `backend/config/settings/base.py`

```python
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
```

Para producción (comentados por defecto):
```python
SECURE_HSTS_SECONDS = 31536000  # 1 año
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
```

### 7. Content Security Policy (CSP)
Headers configurados para prevenir XSS y otros ataques:
- `CSP_DEFAULT_SRC = ("'self'",)`
- Restricciones en scripts, estilos, fuentes e imágenes

### 8. Configuración de Sesión Segura
- `SESSION_COOKIE_AGE = 900` (15 minutos)
- `SESSION_SAVE_EVERY_REQUEST = True`
- `SESSION_EXPIRE_AT_BROWSER_CLOSE = True`

### 9. Registro de Actividad de Login
**Ubicación:** `backend/apps/authentication/models.py` - LoginActivity

Cada intento de login registra:
- Usuario
- Dirección IP
- User Agent
- Timestamp
- Éxito/Fallo

## Mejoras en Frontend (React)

### 1. Indicador de Fortaleza de Contraseña
**Ubicación:** `frontend/src/components/auth/PasswordStrength.jsx`

Componente visual que muestra:
- Barra de progreso con código de colores
- Nivel de fortaleza (Muy débil a Muy fuerte)
- Lista de requisitos cumplidos/pendientes

### 2. Auto-logout por Inactividad
**Ubicación:** `frontend/src/hooks/useInactivityLogout.js`

- Monitorea eventos del usuario (mouse, teclado, scroll, touch)
- Advertencia a los 14 minutos
- Cierra sesión automáticamente a los 15 minutos
- Se resetea con cualquier actividad del usuario

### 3. Utilidades de Seguridad
**Ubicación:** `frontend/src/utils/security.js`

Funciones implementadas:

#### sanitizeInput(input)
- Escapa caracteres HTML peligrosos
- Previene XSS en inputs de usuario

#### validatePasswordStrength(password)
- Valida requisitos de contraseña fuerte
- Retorna lista de errores específicos

#### getCsrfToken()
- Extrae token CSRF de cookies
- Usado en requests que modifican datos

#### isSafeUrl(url)
- Valida URLs antes de redireccionar
- Previene ataques de Open Redirect

#### detectMaliciousContent(content)
- Detecta scripts y contenido malicioso
- Busca patrones peligrosos (script, iframe, etc.)

#### sanitizeFormData(formData)
- Limpia todos los campos de un formulario
- Aplica sanitización recursiva

### 4. Integración de CSRF Token
**Ubicación:** `frontend/src/services/api.js`

- Interceptor de Axios modificado
- Agrega X-CSRFToken header en POST/PUT/PATCH/DELETE
- Obtiene token de cookies automáticamente

### 5. Almacenamiento Seguro de Tokens
Actualmente usa localStorage, consideraciones:
- Para mayor seguridad, se recomienda usar httpOnly cookies
- Los tokens JWT tienen expiración corta (60 minutos)
- Refresh tokens con rotación activada

## Dependencias Agregadas

### Backend
```
django-ratelimit==4.1.0      # Rate limiting
django-axes==6.1.1            # Protección adicional contra brute force
cryptography==42.0.0          # Encriptación de datos
django-defender==0.9.7        # Defensa contra ataques
```

### Frontend
No se requieren dependencias adicionales (todo implementado con código nativo)

## Configuración Requerida

### Variables de Entorno
```bash
SECRET_KEY=<clave-secreta-fuerte>  # Mínimo 50 caracteres aleatorios
DEBUG=False                         # En producción
REDIS_URL=redis://localhost:6379/0 # Para rate limiting
```

### Base de Datos
Ejecutar migración:
```bash
python manage.py migrate authentication
```

### Para Producción
Descomentar en `settings/base.py`:
```python
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

## Checklist de Seguridad

### Backend
- [x] Rate limiting en login
- [x] Bloqueo de cuenta por intentos fallidos
- [x] Validación de contraseñas fuertes
- [x] Expiración de contraseñas (90 días)
- [x] Encriptación de datos sensibles
- [x] Headers de seguridad HTTP
- [x] Content Security Policy
- [x] Timeout de sesión por inactividad
- [x] Registro de actividad de login
- [x] Protección CSRF

### Frontend
- [x] Indicador de fortaleza de contraseña
- [x] Auto-logout por inactividad
- [x] Sanitización de inputs
- [x] Validación de URLs
- [x] Detección de contenido malicioso
- [x] Integración de CSRF tokens
- [x] Manejo seguro de errores

## Pruebas Recomendadas

1. **Probar bloqueo de cuenta:**
   - Intentar login con credenciales incorrectas 5 veces
   - Verificar que la cuenta se bloquee por 30 minutos

2. **Probar expiración de contraseña:**
   - Modificar `password_changed_at` a hace 91 días
   - Intentar login y verificar que pida cambio de contraseña

3. **Probar fortaleza de contraseña:**
   - Intentar crear contraseña débil
   - Verificar mensajes de error específicos

4. **Probar inactividad:**
   - Login exitoso
   - No interactuar por 15 minutos
   - Verificar logout automático

5. **Probar rate limiting:**
   - Hacer más de 5 requests de login en 1 minuto
   - Verificar bloqueo temporal

## Mantenimiento

### Actualizar lista de contraseñas comprometidas
Editar `backend/apps/authentication/validators.py`:
```python
COMPROMISED_PASSWORDS = {
    # Agregar nuevas contraseñas comprometidas
}
```

### Ajustar timeouts
En `backend/apps/authentication/security_middleware.py`:
```python
INACTIVITY_TIMEOUT = timedelta(minutes=15)  # Cambiar según necesidad
```

En `frontend/src/hooks/useInactivityLogout.js`:
```javascript
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;  // Cambiar según necesidad
```

## Soporte y Contacto
Para preguntas o problemas relacionados con la seguridad del sistema, contactar al equipo de desarrollo.
