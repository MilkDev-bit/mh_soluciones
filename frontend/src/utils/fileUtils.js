// Obtener la URL base de la API desde la configuración
const getAPIBaseURL = () => {
  // En desarrollo, usar la variable de entorno o localhost
  if (import.meta.env.DEV) {
    const apiUrl = import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1';
    // Remover /api/v1 del final para obtener la URL base
    return apiUrl.replace(/\/api\/v1\/?$/, '');
  }
  // En producción, usar el protocolo y host actual
  return `${window.location.protocol}//${window.location.host}`;
};

/**
 * Determina si un archivo se puede visualizar directamente en el navegador
 * @param {string} fileUrl - URL del archivo
 * @returns {boolean} - true si se puede visualizar, false si debe descargarse
 */
const isViewableInBrowser = (fileUrl) => {
  if (!fileUrl) return false;
  
  // Convertir a minúsculas para comparación case-insensitive
  const url = fileUrl.toLowerCase();
  
  // Extensiones que el navegador puede visualizar directamente
  const viewableExtensions = [
    '.pdf',           // PDFs
    '.png',           // Imágenes
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.txt',           // Texto plano
  ];
  
  return viewableExtensions.some(ext => url.endsWith(ext));
};

/**
 * Obtiene el nombre del archivo desde una URL
 * @param {string} fileUrl - URL del archivo
 * @returns {string} - Nombre del archivo
 */
const getFileNameFromUrl = (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const pathname = url.pathname;
    const parts = pathname.split('/');
    return parts[parts.length - 1] || 'download';
  } catch (error) {
    // Si falla el parsing de URL, extraer el nombre de otra forma
    const parts = fileUrl.split('/');
    return parts[parts.length - 1] || 'download';
  }
};

/**
 * Descarga un archivo directamente sin abrir ventana
 * Usa fetch + Blob para evitar problemas de CORS y políticas de navegador
 * @param {string} fileUrl - URL del archivo a descargar
 */
const downloadFile = async (fileUrl) => {
  try {
    // Mostrar indicador de carga (opcional)
    console.log('Iniciando descarga:', fileUrl);
    
    // Descargar el archivo como Blob
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Error al descargar: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Crear una URL local temporal para el Blob
    const blobUrl = URL.createObjectURL(blob);
    
    // Crear un elemento <a> temporal con la URL del Blob
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = getFileNameFromUrl(fileUrl);
    link.style.display = 'none';
    
    // Agregarlo al DOM, hacer clic, y removerlo
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Liberar la URL del Blob después de un tiempo
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);
    
    console.log('Descarga completada:', getFileNameFromUrl(fileUrl));
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    
    // Fallback: intentar abrir en nueva pestaña
    // Si fetch falla, al menos mostramos el archivo de alguna forma
    window.open(fileUrl, '_blank');
  }
};

export const handleViewFile = async (doc) => {
  // Prioridad: file_url (URL absoluta) > file (URL relativa)
  let fileUrl = doc.file_url || doc.file;
  
  if (!fileUrl) {
    console.error("El documento no tiene una URL válida.", doc);
    return;
  }
  
  // Si la URL es relativa (no empieza con http:// o https://), convertirla a absoluta
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    const baseURL = getAPIBaseURL();
    // Asegurarse de que fileUrl comience con /
    fileUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
    fileUrl = `${baseURL}${fileUrl}`;
  }
  
  // Log para debugging
  console.log('handleViewFile llamado con URL:', fileUrl);
  
  // Verificar si el archivo se puede visualizar en el navegador
  if (isViewableInBrowser(fileUrl)) {
    // PDFs e imágenes: abrir en nueva ventana
    console.log('Archivo visualizable, abriendo en ventana nueva');
    const width = 800;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`;
    
    window.open(fileUrl, 'FileViewer', windowFeatures);
  } else {
    // Word, Excel, PowerPoint, ZIP, etc.: descargar directamente sin abrir ventana
    console.log('Archivo no visualizable, iniciando descarga');
    await downloadFile(fileUrl);
  }
};