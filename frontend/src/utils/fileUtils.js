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
    '.txt',           // Texto plano (aunque no es común)
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
  } catch {
    // Si falla el parsing de URL, extraer el nombre de otra forma
    const parts = fileUrl.split('/');
    return parts[parts.length - 1] || 'download';
  }
};

/**
 * Descarga un archivo directamente sin abrir ventana
 * @param {string} fileUrl - URL del archivo a descargar
 */
const downloadFile = (fileUrl) => {
  // Crear un elemento <a> temporal
  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = getFileNameFromUrl(fileUrl);
  link.style.display = 'none';
  
  // Agregarlo al DOM, hacer clic, y removerlo
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const handleViewFile = (doc) => {
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
  
  // Verificar si el archivo se puede visualizar en el navegador
  if (isViewableInBrowser(fileUrl)) {
    // PDFs e imágenes: abrir en nueva ventana
    const width = 800;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`;
    
    window.open(fileUrl, 'FileViewer', windowFeatures);
  } else {
    // Word, Excel, PowerPoint, ZIP, etc.: descargar directamente sin abrir ventana
    downloadFile(fileUrl);
  }
};