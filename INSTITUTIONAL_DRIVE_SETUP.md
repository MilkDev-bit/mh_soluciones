# Configuración de Google Drive Institucional

Este documento explica cómo configurar y usar el sistema de Google Drive institucional centralizado.

## Cambios Implementados

### 1. **Credenciales Institucionales**

Todos los archivos ahora se suben al Google Drive de un usuario administrador institucional, en lugar de usar las credenciales individuales de cada usuario.

**Beneficios:**
- ✅ Los estudiantes NO necesitan conectar su Google Drive personal
- ✅ Todos los archivos están centralizados en una cuenta institucional
- ✅ Mejor gestión y backup de archivos
- ✅ Estructura organizada por proyectos

### 2. **Nueva Estructura de Carpetas**

#### Para Documentos:
```
Google Drive Root
└── MH Soluciones/
    └── [Año] (ej: 2025)/
        └── [Proyecto] (ej: "proyecto-abc")/
            ├── Documentos/
            ├── Administrativo/
            ├── Imagenes/
            ├── Videos/
            └── Otros/
```

#### Para Entregas de Tareas:
```
Google Drive Root
└── MH Soluciones/
    └── [Año] (ej: 2025)/
        └── [Proyecto] (ej: "proyecto-abc")/
            └── Tareas/
                └── [Nombre-Tarea]/
                    └── [Estudiante]/
                        ├── Entrega_v1/
                        ├── Entrega_v2/
                        └── Entrega_v3/
```

### 3. **Nuevo Endpoint**

**Endpoint:** `GET /api/projects/<project_id>/drive-folder/`

Permite obtener todos los documentos de Google Drive de un proyecto específico.

**Permisos:**
- Clientes solo ven archivos de SUS proyectos
- Admins ven todos los archivos

**Respuesta:**
```json
{
  "project_name": "Nombre del Proyecto",
  "total_documents": 10,
  "documents": [
    {
      "id": 1,
      "name": "documento.pdf",
      "file_type": "application/pdf",
      "file_size": 1024000,
      "folder_type": "DOCUMENTOS",
      "drive_file_url": "https://drive.google.com/...",
      "drive_file_id": "1abc...",
      "uploaded_by": {
        "name": "Juan Pérez",
        "username": "juan.perez"
      },
      "created_at": "2025-12-18T10:00:00Z"
    }
  ]
}
```

## Configuración en Railway

### Variables de Entorno Requeridas

Agrega estas variables en tu proyecto de Railway:

```bash
# ID del usuario administrador (ej: 1 para el superusuario)
GOOGLE_DRIVE_ADMIN_USER_ID=1

# ID de la carpeta raíz en Google Drive donde se crearán las carpetas
GOOGLE_DRIVE_ROOT_FOLDER_ID=<tu_folder_id>

# Credenciales OAuth de Google (las mismas que ya tienes)
GOOGLE_CLIENT_ID=<tu_client_id>
GOOGLE_CLIENT_SECRET=<tu_client_secret>
```

### Pasos para Implementar

1. **Conectar Google Drive del Admin:**
   - Login como superusuario en la aplicación
   - Ir a `/profile` o la página de perfil
   - Click en "Conectar con Google Drive"
   - Autorizar el acceso a Google Drive
   - Verificar que las credenciales se guardaron correctamente

2. **Configurar Variables en Railway:**
   - Ir a tu proyecto en Railway
   - Sección "Variables"
   - Agregar `GOOGLE_DRIVE_ADMIN_USER_ID=1` (o el ID del admin)
   - Verificar que `GOOGLE_DRIVE_ROOT_FOLDER_ID` esté configurado

3. **Crear Carpeta Raíz en Google Drive:**
   - Acceder a Google Drive con la cuenta institucional
   - Crear una carpeta raíz (ej: "MH Soluciones Files")
   - Copiar el ID de la carpeta de la URL:
     `https://drive.google.com/drive/folders/1abc...` → `1abc...`
   - Usar ese ID en `GOOGLE_DRIVE_ROOT_FOLDER_ID`

4. **Redeploy:**
   - Railway detectará los cambios
   - El deploy se ejecutará automáticamente

5. **Probar:**
   - Subir un documento desde cualquier usuario
   - Verificar que el archivo aparece en el Drive del admin
   - Verificar la estructura de carpetas (MH Soluciones/Año/Proyecto/...)

## Cambios en el Código

### 1. `GoogleDriveService` (`backend/apps/documents/services.py`)

**Antes:**
```python
drive_service = GoogleDriveService(user=current_user)
```

**Después:**
```python
# Usar credenciales institucionales
drive_service = GoogleDriveService(use_institutional=True)
```

### 2. Archivos Modificados

- ✅ `backend/config/settings/base.py` - Nueva variable `GOOGLE_DRIVE_ADMIN_USER_ID`
- ✅ `backend/apps/documents/services.py` - Soporte para credenciales institucionales
- ✅ `backend/apps/documents/models.py` - Usar credenciales institucionales
- ✅ `backend/apps/documents/tasks.py` - Tarea Celery usa credenciales institucionales
- ✅ `backend/apps/tasks/api/views.py` - Entregas de tareas usan credenciales institucionales
- ✅ `backend/apps/projects/api/views.py` - Nuevo endpoint para archivos del proyecto
- ✅ `backend/apps/projects/api/urls.py` - Ruta para el nuevo endpoint

## Verificación

### Checklist Post-Deploy

- [ ] Admin ha conectado su Google Drive
- [ ] Variable `GOOGLE_DRIVE_ADMIN_USER_ID` está configurada
- [ ] Variable `GOOGLE_DRIVE_ROOT_FOLDER_ID` está configurada
- [ ] Se puede subir un documento
- [ ] El documento aparece en el Drive del admin
- [ ] La estructura de carpetas es correcta
- [ ] Endpoint `/api/projects/<id>/drive-folder/` funciona
- [ ] Clientes solo ven archivos de sus proyectos

### Solución de Problemas

**Error: "GOOGLE_DRIVE_ADMIN_USER_ID no está configurado"**
- Verificar que la variable esté en Railway
- Verificar que el valor sea numérico (ej: `1`, no `"1"`)

**Error: "Usuario admin con ID X no encontrado"**
- Verificar que el usuario exista en la base de datos
- Usar el comando: `python manage.py shell` y ejecutar `from apps.authentication.models import CustomUser; CustomUser.objects.filter(is_superuser=True)`

**Error: "El usuario no ha vinculado su cuenta de Google"**
- El admin debe conectar su Google Drive desde el perfil
- Verificar en `GoogleApiCredentials` que existan credenciales para el usuario admin

## Migración de Archivos Existentes (Opcional)

Si tienes archivos en Drives personales que quieres migrar:

1. Los archivos antiguos permanecen en sus ubicaciones actuales
2. Los nuevos archivos van al Drive institucional
3. Para migrar archivos existentes, necesitarás:
   - Script personalizado para re-subir archivos
   - O mover manualmente desde Google Drive

## Seguridad

- ✅ Los clientes solo pueden ver archivos de proyectos donde son miembros
- ✅ Los permisos se verifican en el endpoint
- ✅ Los archivos siguen la misma autenticación de Django
- ✅ Las credenciales OAuth se almacenan de forma segura en la BD

## Soporte

Si encuentras problemas:
1. Verificar logs en Railway
2. Revisar que las variables de entorno estén configuradas
3. Verificar que el admin tenga credenciales OAuth válidas
