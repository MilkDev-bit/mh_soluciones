export const handleViewFile = (doc) => {
  const fileUrl = doc.file || doc.file_url; 
  
  if (fileUrl) {
    const width = 800;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`;
    
    window.open(fileUrl, 'PDFViewer', windowFeatures);
  } else {
    console.error("El documento no tiene una URL válida.", doc);
  }
};