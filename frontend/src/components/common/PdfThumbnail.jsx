import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Use the worker as a static file served from /public to avoid MIME type issues
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
// Suppress internal PDF.js warnings (TT font hints, number format warnings, etc.)
pdfjsLib.verbosity = pdfjsLib.VerbosityLevel ? pdfjsLib.VerbosityLevel.ERRORS : 0;

const THUMBNAIL_WIDTH = 280;

/*
 * [RENDIMIENTO] Antes cada tarjeta PDF visible descargaba el PDF COMPLETO
 * y todas a la vez: con 20 PDFs en pantalla el navegador se trababa.
 * Ahora:
 *  - máximo 2 miniaturas generándose al mismo tiempo (cola),
 *  - pdf.js pide solo los bytes de la primera página (range requests),
 *  - la miniatura generada se guarda en memoria: volver a una carpeta no
 *    vuelve a descargar nada,
 *  - el documento se libera al terminar.
 */
const MAX_CONCURRENT = 2;
const thumbCache = new Map(); // url -> dataURL | 'error'
let running = 0;
const queue = [];

const runQueued = (job) => new Promise((resolve, reject) => {
  queue.push({ job, resolve, reject });
  pump();
});

function pump() {
  while (running < MAX_CONCURRENT && queue.length) {
    const { job, resolve, reject } = queue.shift();
    running += 1;
    job().then(resolve, reject).finally(() => {
      running -= 1;
      pump();
    });
  }
}

const PdfThumbnail = ({ url, fileName, fallbackIcon }) => {
  const containerRef = useRef(null);
  const cached = thumbCache.get(url);
  const [error, setError] = useState(cached === 'error');
  const [dataUrl, setDataUrl] = useState(cached && cached !== 'error' ? cached : null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !url || error || dataUrl) return undefined;

    let cancelled = false;

    const renderPdf = async () => {
      let pdf = null;
      try {
        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: true,
          disableAutoFetch: true, // no bajar el resto del archivo
          disableStream: true,    // usar range requests (solo la 1.ª página)
          rangeChunkSize: 65536,
        });
        pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        const scale = THUMBNAIL_WIDTH / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise;
        const result = canvas.toDataURL('image/jpeg', 0.7);
        thumbCache.set(url, result);
        if (!cancelled) {
          setDataUrl(result);
        }
      } catch (err) {
        thumbCache.set(url, 'error');
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (pdf) pdf.destroy();
      }
    };

    runQueued(() => (cancelled ? Promise.resolve() : renderPdf()));
    return () => { cancelled = true; };
  }, [isVisible, url, error, dataUrl]);

  if (error || !url) {
    return <span className="icono-tipo-grande">{fallbackIcon}</span>;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={fileName || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span className="icono-tipo-grande">{fallbackIcon}</span>
      )}
    </div>
  );
};

export default PdfThumbnail;
