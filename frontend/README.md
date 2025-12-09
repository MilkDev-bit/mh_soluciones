# MH Soluciones - Frontend

Frontend de la aplicación MH Soluciones, construido con React + Vite.

## Configuración de Entorno

### Variables de Entorno

Este proyecto utiliza variables de entorno para configurar las URLs de conexión al backend. Copia el archivo `.env.example` a `.env` y configura las variables según tu entorno:

```bash
cp .env.example .env
```

#### Variables Disponibles

- **`VITE_API_URL_BASE`**: URL base del API del backend (incluye `/api/v1` al final)
  - Desarrollo: `http://localhost:8000/api/v1`
  - Producción: `https://backend-production-xxxx.up.railway.app/api/v1`

- **`VITE_WS_URL_BASE`**: URL base para conexiones WebSocket
  - Desarrollo: `ws://localhost:8000`
  - Producción: `wss://backend-production-xxxx.up.railway.app`

### Ejemplos de Configuración

#### Desarrollo Local

```env
VITE_API_URL_BASE=http://localhost:8000/api/v1
VITE_WS_URL_BASE=ws://localhost:8000
```

#### Producción (Railway)

```env
VITE_API_URL_BASE=https://backend-production-21f4.up.railway.app/api/v1
VITE_WS_URL_BASE=wss://backend-production-21f4.up.railway.app
```

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

El servidor de desarrollo se ejecutará en `http://localhost:5173`

## Build para Producción

```bash
npm run build
```

Los archivos compilados se generarán en el directorio `dist/`

## Lint

```bash
npm run lint
```

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── assets/         # Recursos estáticos (imágenes, estilos)
│   ├── components/     # Componentes reutilizables
│   ├── pages/          # Páginas de la aplicación
│   ├── services/       # Servicios de API y lógica de negocio
│   ├── utils/          # Utilidades y helpers
│   ├── App.jsx         # Componente principal
│   └── main.jsx        # Punto de entrada
├── public/             # Archivos públicos
├── .env.example        # Ejemplo de variables de entorno
└── vite.config.js      # Configuración de Vite
```

## Notas Importantes

- **NUNCA** commites el archivo `.env` al repositorio
- El archivo `.env.example` debe mantenerse actualizado con todas las variables necesarias
- Las variables de entorno deben comenzar con `VITE_` para ser expuestas al cliente
- Cambios en variables de entorno requieren reiniciar el servidor de desarrollo
