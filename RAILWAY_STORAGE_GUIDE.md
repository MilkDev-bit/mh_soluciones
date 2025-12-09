# 📦 Guía de Almacenamiento para Railway: Alternativas a AWS S3

## 🎯 Resumen Ejecutivo

Para reemplazar AWS S3 en Railway, tienes **tres opciones principales**:

1. **Railway Volumes** (Recomendado para producción) - Almacenamiento persistente nativo
2. **Google Drive** (Ya implementado en tu proyecto) - Almacenamiento en la nube gratuito
3. **Cloudflare R2** (Alternativa compatible con S3) - Sin costos de egreso

---

## 🚂 Opción 1: Railway Volumes (RECOMENDADO)

Railway Volumes es el servicio nativo de Railway para almacenamiento persistente, **100% compatible y recomendado para producción**.

### ✅ Ventajas

- **Nativo de Railway**: Integración perfecta con tu aplicación
- **Persistente**: Los datos sobreviven redespliegues y reinicios
- **Rápido**: Acceso local sin latencia de red
- **Simple**: No requiere credenciales externas
- **Incluido**: En el plan de Railway, sin costos adicionales por almacenamiento básico
- **Respaldos**: Railway maneja los respaldos automáticamente

### 📊 Características

| Característica | Railway Volumes |
|----------------|-----------------|
| **Capacidad** | 50 GB incluidos, escalable según plan |
| **Velocidad** | Alta (almacenamiento local) |
| **Persistencia** | Sí, incluso al redesplegar |
| **Backup** | Automático por Railway |
| **Costo** | Incluido en el plan base |

### 🔧 Configuración

#### Paso 1: Crear un Volume en Railway

1. Ve a tu proyecto en Railway Dashboard
2. Selecciona tu servicio **Backend**
3. Ve a la pestaña **"Settings"** → **"Volumes"**
4. Click en **"New Volume"**
5. Configura:
   - **Name**: `media-storage` (o el nombre que prefieras)
   - **Mount Path**: `/app/mediafiles`
   - **Size**: 10 GB (ajustar según necesidad)
6. Click en **"Add"**

#### Paso 2: Configurar Django para usar Railway Volumes

Tu proyecto **ya está configurado** para usar almacenamiento local cuando no hay credenciales S3. No necesitas cambios adicionales en el código.

Verificación en `backend/config/settings/railway.py`:

```python
# Media files configuration for Railway
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'mediafiles'
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
```

#### Paso 3: Servir archivos media en producción

Django servirá los archivos estáticos a través de la vista configurada en `urls.py`:

```python
# Ya configurado en tu proyecto
urlpatterns += [
    path('media/<path:path>', serve, {'document_root': settings.MEDIA_ROOT}),
]
```

#### Paso 4: Variables de Entorno

**NO configures** estas variables si quieres usar Railway Volumes en lugar de S3:
- ❌ `AWS_ACCESS_KEY_ID`
- ❌ `AWS_SECRET_ACCESS_KEY`
- ❌ `AWS_STORAGE_BUCKET_NAME`

Si estas variables **no están configuradas**, Django automáticamente usará el almacenamiento local (Railway Volume).

### 🎯 Mejores Prácticas

1. **Tamaño del Volume**: 
   - Comienza con 10 GB
   - Monitorea el uso en Railway Dashboard
   - Escala según necesidad

2. **Backups**:
   - Railway hace backups automáticos
   - Para backups adicionales, considera exportar archivos periódicamente

3. **Permisos**:
   - El directorio `/app/mediafiles` será automáticamente accesible por tu aplicación
   - No necesitas configurar permisos especiales

4. **Desempeño**:
   - Railway Volumes ofrece excelente rendimiento
   - Más rápido que S3 para archivos pequeños y medianos

### ⚠️ Consideraciones Importantes

- **Un Volume por Servicio**: Cada instancia del servicio comparte el mismo volume
- **No CDN integrado**: Si necesitas CDN, considera Cloudflare en frente
- **Límite de archivos grandes**: Para archivos muy grandes (>100 MB), considera Cloudflare R2

---

## 🌐 Opción 2: Google Drive (YA IMPLEMENTADO)

Tu proyecto **ya tiene integración con Google Drive** completa y funcional.

### ✅ Ventajas

- **Ya implementado**: No requiere código adicional
- **Gratuito**: 15 GB gratis por cuenta de Google
- **Escalable**: Upgrade a Google Workspace para más espacio
- **Compartible**: Fácil compartir archivos con clientes
- **Interfaz**: Los usuarios pueden ver archivos en Google Drive

### 📁 Archivos Relacionados

Tu proyecto incluye estas implementaciones de Google Drive:

- `backend/apps/documents/services.py` - Servicio de Google Drive
- `backend/apps/documents/api/views.py` - API endpoints
- `backend/apps/tasks/models.py` - Integración con tareas

### 🔧 Configuración

Google Drive está configurado mediante estas variables de entorno:

```bash
GOOGLE_DRIVE_ROOT_FOLDER_ID=tu-folder-id
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
```

### 🎯 Uso en tu Aplicación

El servicio `GoogleDriveService` en tu proyecto permite:

1. **Subir documentos** a carpetas organizadas
2. **Descargar archivos** desde Google Drive
3. **Eliminar documentos** cuando sea necesario
4. **Organización automática** por proyectos y usuarios

### 💡 Caso de Uso Ideal

Google Drive es perfecto para:
- Documentos de proyectos
- Archivos compartidos con clientes
- Documentación empresarial
- Archivos que necesitan colaboración

---

## ☁️ Opción 3: Cloudflare R2 (Alternativa Compatible con S3)

Si necesitas compatibilidad con S3 pero sin los costos de AWS, **Cloudflare R2** es excelente.

### ✅ Ventajas

- **Compatible con S3**: Usa la misma API que AWS S3
- **Sin costos de egreso**: No pagas por descargas (gran ahorro vs S3)
- **CDN incluido**: Cloudflare CDN integrado
- **Precio bajo**: $0.015 por GB almacenado
- **Rápido**: Red global de Cloudflare

### 💰 Precios Cloudflare R2

| Recurso | Precio |
|---------|--------|
| **Almacenamiento** | $0.015/GB/mes |
| **Operaciones Clase A** (write) | $4.50 por millón |
| **Operaciones Clase B** (read) | $0.36 por millón |
| **Egreso (Descargas)** | **GRATIS** ⭐ |

**Ejemplo de costos**:
- 100 GB almacenados = $1.50/mes
- 1 millón de descargas = $0 (vs ~$90 en AWS S3)

### 🔧 Configuración con Cloudflare R2

#### Paso 1: Crear un Bucket en Cloudflare

1. Ve a Cloudflare Dashboard
2. Selecciona **R2** en el menú
3. Click en **"Create bucket"**
4. Nombre: `mh-soluciones-media`
5. Click en **"Create"**

#### Paso 2: Generar Access Keys

1. En Cloudflare R2, ve a **"Manage R2 API Tokens"**
2. Click en **"Create API Token"**
3. Permisos: **"Admin Read & Write"**
4. Copia:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (ejemplo: `https://[account-id].r2.cloudflarestorage.com`)

#### Paso 3: Configurar Variables de Entorno en Railway

```bash
# Cloudflare R2 Configuration
AWS_ACCESS_KEY_ID=tu-r2-access-key-id
AWS_SECRET_ACCESS_KEY=tu-r2-secret-access-key
AWS_STORAGE_BUCKET_NAME=mh-soluciones-media
AWS_S3_ENDPOINT_URL=https://[tu-account-id].r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
```

#### Paso 4: Actualizar Django Settings

Necesitas agregar esta configuración en `config/settings/railway.py`:

```python
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    # Cloudflare R2 configuration
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'mh-soluciones-media')
    AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL')  # Cloudflare R2 endpoint
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'auto')
    
    # Custom domain for R2 (opcional)
    if AWS_S3_ENDPOINT_URL:
        AWS_S3_CUSTOM_DOMAIN = AWS_S3_ENDPOINT_URL.replace('https://', '').replace('http://', '')
    else:
        AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.r2.cloudflarestorage.com'
    
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
```

#### Paso 5: Instalar boto3 (Ya instalado)

Tu proyecto ya tiene `boto3` y `django-storages` en `requirements/base.txt`.

### 🌍 Cloudflare R2 con Custom Domain (Opcional)

Para usar tu propio dominio:

1. En Cloudflare R2, selecciona tu bucket
2. Ve a **"Settings"** → **"Custom Domains"**
3. Agrega: `media.mhsolucionesempresariales.com`
4. Cloudflare configurará DNS automáticamente
5. Actualiza `AWS_S3_CUSTOM_DOMAIN` a tu dominio personalizado

---

## 🆚 Comparación de Opciones

| Característica | Railway Volumes | Google Drive | Cloudflare R2 |
|----------------|-----------------|--------------|---------------|
| **Costo Mensual (100GB)** | ~$5 (incluido) | Gratis (15GB) | $1.50 |
| **Velocidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **CDN** | No | No | Sí (incluido) |
| **Egreso (Descargas)** | Incluido | Gratis | Gratis |
| **Configuración** | ⭐⭐⭐⭐⭐ Muy fácil | ⭐⭐⭐ Media | ⭐⭐⭐⭐ Fácil |
| **Compatibilidad S3** | No | No | Sí |
| **Backup Automático** | Sí | Sí | Configurable |
| **Límite de archivos** | Por plan | 15GB gratis | Ilimitado* |
| **Mejor para** | Uso general | Documentos | Archivos públicos |

\* Ilimitado con costo por uso

---

## 🎯 Recomendación para tu Proyecto

### Escenario 1: Producción Simple
**Usa: Railway Volumes + Google Drive**

```
- Railway Volumes: Archivos temporales, caché, uploads pequeños
- Google Drive: Documentos de proyectos, archivos importantes
```

**Ventajas**:
- ✅ Ya implementado (Google Drive)
- ✅ Costo mínimo
- ✅ Simple de mantener

### Escenario 2: Alto Tráfico / Muchas Descargas
**Usa: Cloudflare R2**

```
- Cloudflare R2: Todos los archivos estáticos y media
- CDN integrado para descargas rápidas globales
```

**Ventajas**:
- ✅ Sin costo de egreso (gran ahorro)
- ✅ CDN global incluido
- ✅ Compatible con S3 (fácil migración)

### Escenario 3: Hybrid (RECOMENDADO)
**Usa: Railway Volumes + Google Drive**

```
- Railway Volumes: Archivos temporales, procesamiento
- Google Drive: Documentos permanentes, archivos de proyectos
```

**Ventajas**:
- ✅ Mejor de ambos mundos
- ✅ Costo optimizado
- ✅ Ya está implementado

---

## 🚀 Implementación Recomendada

### Para Comenzar: Railway Volumes

```bash
# 1. Crear Volume en Railway Dashboard
#    - Name: media-storage
#    - Mount Path: /app/mediafiles
#    - Size: 10 GB

# 2. NO configurar estas variables (para usar local storage):
# AWS_ACCESS_KEY_ID (vacío)
# AWS_SECRET_ACCESS_KEY (vacío)

# 3. Redesplegar el servicio
railway up
```

### Variables de Entorno Necesarias

```bash
# Backend URL
BACKEND_URL=https://tu-backend.railway.app

# Frontend URL
FRONTEND_URL=https://tu-frontend.railway.app

# Google Drive (si lo usas)
GOOGLE_DRIVE_ROOT_FOLDER_ID=tu-folder-id
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret

# Database (auto-configurado por Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (auto-configurado por Railway)
REDIS_URL=${{Redis.REDIS_URL}}
```

---

## 📊 Monitoreo de Almacenamiento

### Railway Volumes

1. Ve a Railway Dashboard → Tu Servicio → **"Metrics"**
2. Revisa **"Volume Usage"**
3. Configura alertas si se acerca al límite

### Comandos útiles

```bash
# Ver uso de disco en el container
railway shell
du -sh /app/mediafiles/*

# Listar archivos más grandes
find /app/mediafiles -type f -exec du -h {} + | sort -rh | head -20
```

---

## 🔄 Migración desde AWS S3

Si actualmente usas AWS S3 y quieres migrar:

### Opción A: Migrar a Railway Volumes

```bash
# 1. Descargar archivos de S3
aws s3 sync s3://tu-bucket/media ./local-media

# 2. Crear Volume en Railway

# 3. Subir archivos al Volume
# Puedes usar Railway CLI o una tarea de migración en Django

# 4. Actualizar variables de entorno (remover AWS_*)
```

### Opción B: Migrar a Cloudflare R2

```bash
# Usar rclone para migrar de S3 a R2
rclone sync s3:tu-bucket r2:mh-soluciones-media
```

---

## ❓ Preguntas Frecuentes

### ¿Puedo usar Railway Volumes para archivos estáticos (CSS, JS)?

**Sí**, pero para estáticos usa **Whitenoise** (ya configurado):
- Whitenoise sirve archivos estáticos desde la imagen Docker
- Railway Volumes es mejor para archivos media (uploads de usuarios)

### ¿Qué pasa con mis archivos al redesplegar?

- **Railway Volumes**: Los archivos persisten ✅
- **Sin Volume**: Los archivos se pierden ❌

### ¿Cuánto cuesta Railway Volumes?

Railway Volumes está incluido en tu plan:
- **Hobby**: 100 GB incluidos
- **Pro**: 100 GB incluidos, adicional por GB

### ¿Necesito CDN con Railway Volumes?

Para la mayoría de aplicaciones, no. Si necesitas:
- Distribución global rápida
- Muchas descargas simultáneas
- Considera Cloudflare en frente de Railway

---

## 📚 Recursos Adicionales

- [Railway Volumes Documentation](https://docs.railway.app/reference/volumes)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Django Storage Documentation](https://docs.djangoproject.com/en/4.2/topics/files/)
- [Google Drive API](https://developers.google.com/drive)

---

## ✅ Checklist de Implementación

- [ ] Decidir entre Railway Volumes, Google Drive, o Cloudflare R2
- [ ] Crear Volume en Railway (si usas Volumes)
- [ ] Configurar variables de entorno
- [ ] Verificar que `mediafiles/` está montado en `/app/mediafiles`
- [ ] Probar subida de archivos
- [ ] Probar descarga de archivos
- [ ] Verificar persistencia después de redespliegue
- [ ] Configurar monitoreo de uso de almacenamiento
- [ ] Configurar backup strategy (si es necesario)
- [ ] Documentar configuración para el equipo

---

**Última actualización**: Diciembre 2024
**Versión**: 1.0
