import JSZip from 'jszip';

// Obtener la URL base de la API desde la configuración
const getAPIBaseURL = () => {
  // En desarrollo, usar la variable de entorno o localhost
  if (import.meta.env.DEV) {
    const apiUrl = import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1';
    // Remover /api/v1 del final para obtener la URL base
    return apiUrl.replace(/\/api\/v1\/?$/, '');
  }
  // En producción, SIEMPRE usar HTTPS para evitar Mixed Content errors
  // Esto es seguro porque Railway/Nginx siempre sirven sobre HTTPS
  return `https://${window.location.host}`;
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
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    
    // Fallback: intentar abrir en nueva pestaña
    // Si fetch falla, al menos mostramos el archivo de alguna forma
    window.open(fileUrl, '_blank');
  }
};

export const forceDownloadFile = async (doc) => {
  let fileUrl = doc.file_url || doc.file;
  
  if (!fileUrl) {
    if (doc.drive_file_url) {
      window.open(doc.drive_file_url, '_blank');
      return;
    }
    console.error("El documento no tiene una URL válida.", doc);
    return;
  }
  
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    const baseURL = getAPIBaseURL();
    fileUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
    fileUrl = `${baseURL}${fileUrl}`;
  }
  
  if (!import.meta.env.DEV && fileUrl.startsWith('http://')) {
    fileUrl = fileUrl.replace(/^http:/, 'https:');
  }
  
  await downloadFile(fileUrl);
};

export const downloadFilesAsZip = async (archivos, zipName = 'Archivos.zip') => {
  const zip = new JSZip();
  let hasValidFiles = false;

  for (const doc of archivos) {
    let fileUrl = doc.file_url || doc.file;
    if (!fileUrl) {
      if (doc.drive_file_url) {
        console.warn(`Saltando archivo de Drive sin URL local: ${doc.name}`);
      }
      continue;
    }

    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      const baseURL = getAPIBaseURL();
      fileUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
      fileUrl = `${baseURL}${fileUrl}`;
    }

    if (!import.meta.env.DEV && fileUrl.startsWith('http://')) {
      fileUrl = fileUrl.replace(/^http:/, 'https:');
    }

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Network error: ${response.status}`);
      const blob = await response.blob();
      const fileName = doc.name || getFileNameFromUrl(fileUrl);
      zip.file(fileName, blob);
      hasValidFiles = true;
    } catch (err) {
      console.error(`Error agregando archivo al zip: ${doc.name}`, err);
    }
  }

  if (hasValidFiles) {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = zipName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);
  } else {
    throw new Error('No se pudieron descargar los archivos para crear el ZIP.');
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
  
  // Asegurar que la URL use HTTPS en producción (evitar Mixed Content)
  if (!import.meta.env.DEV && fileUrl.startsWith('http://')) {
    fileUrl = fileUrl.replace(/^http:/, 'https:');
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
    await downloadFile(fileUrl);
  }
};