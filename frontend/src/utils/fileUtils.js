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
  
  // Abrir el archivo en una nueva ventana
  const width = 800;
  const height = 700;
  const left = (window.screen.width / 2) - (width / 2);
  const top = (window.screen.height / 2) - (height / 2);
  const windowFeatures = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`;
  
  window.open(fileUrl, 'PDFViewer', windowFeatures);
};