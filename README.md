# MH Soluciones

Sistema de gestión integral para MH Soluciones.

## Arquitectura

El proyecto consiste en dos servicios principales:

- **Backend**: API REST Django (Python)
- **Frontend**: Aplicación React servida por Nginx

## Despliegue

Para instrucciones detalladas de despliegue en Railway, consulte [DEPLOYMENT.md](./DEPLOYMENT.md).

### Inicio Rápido - Railway

1. **Crear proyecto en Railway** y conectar el repositorio de GitHub
2. **Desplegar Backend**:
   - Agregar servicio desde GitHub
   - Configurar variables de entorno necesarias
3. **Desplegar Frontend**:
   - Agregar servicio desde GitHub
   - Railway configurará automáticamente `BACKEND_URL` usando referencias de servicio

### Variables de Entorno - Frontend

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `BACKEND_URL` | URL del backend para proxy interno | `${{Backend.RAILWAY_PRIVATE_DOMAIN}}:8080` |
| `VITE_API_URL_BASE` | URL pública del API para el navegador | `https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1` |

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para detalles completos.

## Desarrollo Local

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker Compose

```bash
docker-compose up
```

## Características

- 🔐 Autenticación y autorización
- 📊 Gestión de datos
- 📱 Interfaz responsive
- 🚀 Despliegue optimizado en Railway
- 🔒 Proxy inverso para seguridad
- ✅ Health checks automáticos

## Arquitectura de Red en Railway

El frontend funciona como proxy inverso para el backend:

```
Navegador → Frontend (Nginx) → Backend (Django)
              ↓
        /api/* y /media/*
```

**Beneficios**:
- Backend no expuesto directamente
- Sin problemas de CORS
- URLs relativas en el código del frontend

## Troubleshooting

Para problemas de conectividad entre frontend y backend en Railway, consulte la sección [Troubleshooting](./DEPLOYMENT.md#troubleshooting) en DEPLOYMENT.md.

### Problemas Comunes

- **502 Bad Gateway**: Backend no accesible → Verificar que ambos servicios están en ejecución
- **DNS resolution failed**: Verificar configuración de `BACKEND_URL`
- **Connection timeout**: Esperar a que DNS se propague (30-60s)

## Licencia

Privado - MH Soluciones

## Soporte

Para problemas de despliegue en Railway, consulte [DEPLOYMENT.md](./DEPLOYMENT.md).
