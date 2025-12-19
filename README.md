# MH Soluciones Empresariales

Sistema de gestión empresarial para proyectos, tareas y recursos humanos.

## Favicon

El proyecto utiliza el logo de MH Soluciones como favicon en diferentes tamaños.

### Archivos de iconos:

Los iconos están ubicados en `frontend/public/icons/`:
- `icon-72x72.png` a `icon-512x512.png` - Iconos PWA
- `favicon.ico` - Favicon principal (16x16, 32x32, 48x48)

### Regenerar el favicon:

Si necesitas actualizar el favicon:

1. **Opción 1: Herramienta online**
   ```bash
   # Visita https://favicon.io/favicon-converter/
   # Sube frontend/public/icons/icon-512x512.png
   # Descarga y reemplaza frontend/public/favicon.ico
   ```

2. **Opción 2: ImageMagick (si está instalado)**
   ```bash
   convert frontend/public/icons/icon-512x512.png \
     -define icon:auto-resize=16,32,48,64,256 \
     frontend/public/favicon.ico
   ```

3. **Rebuild del proyecto**
   ```bash
   cd frontend
   npm run build
   ```

### Verificar el favicon:

Después del deploy:
1. Abre https://app.mhsolucionesempresariales.com
2. Verifica que el icono aparezca en la pestaña del navegador
3. Si no aparece, limpia la caché (Ctrl+Shift+Delete) o abre en modo incógnito

## Instalación

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Desarrollo

### Scripts NPM disponibles

- `npm run dev` - Inicia el servidor de desarrollo con Vite
- `npm run build` - Construye el proyecto para producción
- `npm run preview` - Preview de la build de producción
- `npm run lint` - Ejecuta ESLint
- `npm run generate-favicon` - Muestra instrucciones para generar el favicon

## Tecnologías

### Frontend
- React 18
- Vite
- React Router
- TanStack Query
- Axios
- Chart.js
- FullCalendar
- Framer Motion
- React Hook Form + Zod

### Backend
- Django
- Django REST Framework
- PostgreSQL
- JWT Authentication

## Licencia

Propietario - MH Soluciones Empresariales
