# PWA y Características Responsivas - MH Soluciones Empresariales

Este documento describe las características de Progressive Web App (PWA) y diseño responsivo implementadas en la aplicación.

## 📱 Progressive Web App (PWA)

La aplicación ahora es una PWA completamente funcional que puede ser instalada en dispositivos móviles, tablets y computadoras de escritorio.

### Características PWA Implementadas

#### ✅ Manifest Web App
- Archivo `manifest.json` con metadatos de la aplicación
- Nombre corto y largo de la aplicación
- Descripción y categorías
- Configuración de colores de tema (#f97316 - naranja principal)
- Modo de visualización standalone (pantalla completa)
- Orientación portrait-primary para móviles

#### ✅ Iconos Multi-Resolución
Iconos generados en 8 tamaños diferentes:
- 72x72px
- 96x96px
- 128x128px
- 144x144px
- 152x152px
- 192x192px
- 384x384px
- 512x512px

Todos los iconos soportan los modos `any` y `maskable` para compatibilidad con diferentes plataformas.

#### ✅ Service Worker con Workbox
Service worker generado automáticamente con estrategias de caché:

**Cache-First (Caché primero)**
- Fuentes de Google Fonts (googleapis.com y gstatic.com)
- Imágenes (PNG, JPG, JPEG, SVG, GIF, WebP)
- Tiempo de expiración: 1 año para fuentes, 30 días para imágenes

**Network-First (Red primero)**
- Llamadas API (`/api/v1/*`)
- Caché de respaldo para funcionalidad offline
- Tiempo de expiración: 5 minutos

**Precaché**
- Todos los archivos estáticos (JS, CSS, HTML)
- Generados automáticamente en cada build

#### ✅ Meta Tags PWA
Configuración completa en `index.html`:
- Theme color para la barra de estado
- Apple mobile web app capable
- Viewport con safe-area para dispositivos con notch
- Apple touch icons para iOS
- Manifest link

#### ✅ Componente de Instalación
Componente `InstallPWA` que:
- Detecta si la app ya está instalada
- Muestra banner de instalación elegante
- Gestiona el evento `beforeinstallprompt`
- Guarda preferencias del usuario (no mostrar por 7 días si se rechaza)
- Diseño responsivo y accesible

### Instalación de la PWA

#### En Dispositivos Móviles (Android/iOS)

**Android (Chrome/Edge)**
1. Abre la app en el navegador
2. Aparecerá un banner de instalación automáticamente
3. También puedes ir a Menú → "Agregar a pantalla de inicio"
4. La app se instalará como una aplicación nativa

**iOS (Safari)**
1. Abre la app en Safari
2. Toca el botón "Compartir" (cuadrado con flecha)
3. Selecciona "Agregar a pantalla de inicio"
4. Personaliza el nombre si lo deseas
5. Toca "Agregar"

#### En Computadoras de Escritorio

**Chrome/Edge**
1. Haz clic en el icono de instalación en la barra de direcciones
2. O ve a Menú → "Instalar MH Soluciones"
3. La app se instalará como una aplicación de escritorio

**Firefox**
1. Haz clic en los tres puntos en la barra de direcciones
2. Selecciona "Instalar"

### Funcionalidad Offline

La aplicación funciona offline con las siguientes capacidades:
- Interfaz completa cargada desde caché
- Imágenes y recursos estáticos disponibles
- Llamadas API con caché de respaldo (últimos datos conocidos)
- Fuentes web cacheadas para tipografía consistente

## 📐 Diseño Responsivo

### Breakpoints

El diseño utiliza un enfoque mobile-first con los siguientes breakpoints:

```scss
$breakpoint-xs: 320px;   // Extra pequeño (móviles pequeños)
$breakpoint-sm: 640px;   // Pequeño (móviles)
$breakpoint-md: 768px;   // Mediano (tablets)
$breakpoint-lg: 1024px;  // Grande (laptops)
$breakpoint-xl: 1280px;  // Extra grande (escritorio)
$breakpoint-2xl: 1536px; // 2X extra grande (pantallas grandes)
```

### Características Responsivas Implementadas

#### ✅ Layout Adaptativo
- **Sidebar**: 
  - Desktop: Fijo con ancho de 16rem
  - Tablet/Mobile: Overlay deslizable
  - Botón de toggle para abrir/cerrar
  
- **Header**: 
  - Altura ajustable según viewport
  - Espaciado responsivo
  - Elementos se adaptan o se ocultan en móviles

- **Content Container**:
  - Padding responsivo (8→6→4→3→2 según viewport)
  - Max-width para legibilidad en pantallas grandes
  - Centrado automático

#### ✅ Componentes Responsivos

**Grids y Cards**
- Grid auto-adaptativo con minmax()
- Cards con padding adaptativo
- En móviles: diseño de una columna
- En tablets: 2 columnas
- En desktop: 3+ columnas según contenido

**Formularios**
- Inputs con tamaño mínimo de 48px en móviles (touch-friendly)
- Font-size de 16px para prevenir zoom en iOS
- Botones full-width en móviles
- Campos organizados en columnas adaptativas

**Tablas**
- Scroll horizontal en móviles
- Modo "card" opcional para mejor UX móvil
- Headers ocultos en vista móvil

**Tipografía Fluida**
- Uso de clamp() para tamaños de fuente adaptables
- Escala automática entre 320px y 1200px viewport
- Pesos de fuente optimizados por tamaño

#### ✅ Utilidades Responsivas

Clases CSS disponibles:

```scss
// Visibilidad
.hide-mobile      // Ocultar en móviles
.hide-tablet      // Ocultar en tablets
.hide-desktop     // Ocultar en escritorio
.show-mobile      // Mostrar solo en móviles
.show-tablet      // Mostrar solo en tablets
.show-desktop     // Mostrar solo en escritorio

// Espaciado
.p-responsive     // Padding adaptativo
.px-responsive    // Padding horizontal adaptativo
.py-responsive    // Padding vertical adaptativo

// Grids
.grid-responsive          // Grid con gaps adaptables
.grid-1-col-mobile       // 1 columna en móviles
.grid-2-col-mobile       // 2 columnas en móviles, 1 en small

// Flex
.flex-responsive         // Flex que se convierte en column en móviles
.flex-responsive-reverse // Reverse en móviles
.flex-wrap-mobile        // Wrap en móviles

// Tipografía
.text-responsive-xl  // Extra grande fluida
.text-responsive-lg  // Grande fluida
.text-responsive-md  // Mediana fluida
.text-responsive-sm  // Pequeña fluida
```

#### ✅ Touch-Friendly

- Tamaños mínimos de toque de 48x48px
- Espaciado adecuado entre elementos interactivos
- Feedback visual mejorado para taps
- Gestos de swipe para navegación móvil
- Safe area padding para dispositivos con notch

#### ✅ Performance

- Lazy loading de imágenes
- Code splitting por rutas
- CSS optimizado y minificado
- Service worker para caché inteligente
- Compresión gzip de assets

### Pruebas de Responsividad

Para probar el diseño responsivo:

1. **Chrome DevTools**
   - Presiona F12 o Ctrl/Cmd + Shift + I
   - Activa el modo dispositivo (Ctrl/Cmd + Shift + M)
   - Prueba diferentes viewports predefinidos
   - Rota el dispositivo (portrait/landscape)

2. **Viewports Recomendados para Pruebas**
   - iPhone SE: 375x667
   - iPhone 12/13: 390x844
   - iPad: 768x1024
   - iPad Pro: 1024x1366
   - Desktop HD: 1920x1080

3. **Lighthouse PWA Audit**
   ```bash
   npm run build
   npx serve -s dist
   # Abrir Chrome DevTools → Lighthouse → PWA
   ```

## 🚀 Comandos de Desarrollo

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview

# Generar íconos PWA
node generate-icons.cjs
```

## 📋 Checklist de Características

### PWA
- ✅ Manifest configurado
- ✅ Service Worker generado
- ✅ Iconos multi-resolución
- ✅ Meta tags completos
- ✅ Estrategias de caché
- ✅ Funcionalidad offline
- ✅ Instalable en todos los dispositivos
- ✅ Componente de prompt de instalación

### Responsive Design
- ✅ Mobile-first approach
- ✅ Breakpoints definidos
- ✅ Layout adaptativo
- ✅ Grids responsivos
- ✅ Tipografía fluida
- ✅ Formularios touch-friendly
- ✅ Tablas adaptables
- ✅ Imágenes responsivas
- ✅ Safe area support
- ✅ Utilidades CSS completas

## 🔧 Configuración Adicional

### Variables de Entorno

Para producción, asegúrate de configurar:
```env
VITE_BACKEND_URL=https://tu-api.com
```

### Actualización de Service Worker

El service worker se actualiza automáticamente con la estrategia `autoUpdate`. Los usuarios recibirán la última versión sin intervención manual.

### Personalización de Colores

Colores principales definidos en `_variables.scss`:
- Primary: #f97316 (Naranja)
- Secondary: #3b82f6 (Azul)
- Success: #10b981 (Verde)
- Warning: #f59e0b (Amarillo)
- Error: #ef4444 (Rojo)

## 📊 Métricas de Rendimiento

Métricas esperadas en Lighthouse:
- Performance: 90+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 90+
- PWA: 100

## 🐛 Solución de Problemas

### La PWA no se puede instalar
- Verifica que estés usando HTTPS (requerido para PWA)
- Verifica que el manifest.json sea válido
- Revisa la consola del navegador para errores

### Service Worker no se registra
- Limpia el caché del navegador
- Verifica que no haya errores en la consola
- Rebuild la aplicación: `npm run build`

### Estilos no responden correctamente
- Verifica los breakpoints en DevTools
- Limpia el caché de Sass
- Rebuild: `npm run build`

## 📚 Recursos Adicionales

- [MDN - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web.dev - PWA Training](https://web.dev/learn/pwa/)
