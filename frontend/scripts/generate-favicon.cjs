const fs = require('fs');
const path = require('path');

console.log('📦 Generador de favicon para MH Soluciones');
console.log('');
console.log('ℹ️  Este proyecto usa los iconos existentes en /icons/');
console.log('');
console.log('Para generar el favicon.ico:');
console.log('1. Visita: https://favicon.io/favicon-converter/');
console.log('2. Sube: frontend/public/icons/icon-512x512.png');
console.log('3. Descarga el favicon.ico generado');
console.log('4. Guárdalo en: frontend/public/favicon.ico');
console.log('');
console.log('O usa ImageMagick:');
console.log('  convert frontend/public/icons/icon-512x512.png -define icon:auto-resize=16,32,48,64,256 frontend/public/favicon.ico');
