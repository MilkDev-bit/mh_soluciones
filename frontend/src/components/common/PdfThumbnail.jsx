import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Use the worker as a static file served from /public to avoid MIME type issues
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
// Suppress internal PDF.js warnings (TT font hints, number format warnings, etc.)
pdfjsLib.verbosity = pdfjsLib.VerbosityLevel ? pdfjsLib.VerbosityLevel.ERRORS : 0;

const THUMBNAIL_WIDTH = 280;

const PdfThumbnail = ({ url, fileName, fallbackIcon }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
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
    if (!isVisible || !url || error) return;

    let cancelled = false;

    const renderPdf = async () => {
      try {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1 });
        // Scale to fit the canvas container (max width ~280px)
        const scale = THUMBNAIL_WIDTH / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.warn('PdfThumbnail error:', err);
          setError(true);
          setLoading(false);
        }
      }
    };

    renderPdf();
    return () => { cancelled = true; };
  }, [url, error]);

  if (error || !url) {
    return <span className="icono-tipo-grande">{fallbackIcon}</span>;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {(!isVisible || loading) && <span className="icono-tipo-grande">{fallbackIcon}</span>}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: isVisible && !loading ? 'block' : 'none',
        }}
      />
    </div>
  );
};

export default PdfThumbnail;
