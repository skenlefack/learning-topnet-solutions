'use client';
// ============================================================================
// AU-IBAR Learning — Professional Document Viewer
// Renders PDFs (via PDF.js), audio, video, HTML, and Office previews
// ============================================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download,
  Maximize2, Minimize2, FileText, Volume2, Play,
} from 'lucide-react';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentViewerProps {
  url: string;
  pdfPreviewUrl?: string;
  mimeType?: string;
  filename?: string;
  onProgress?: (percent: number) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// PDF Viewer (using PDF.js)
// ---------------------------------------------------------------------------

function PdfViewer({ url, onProgress, className }: { url: string; onProgress?: (p: number) => void; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js dynamically
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        const loadingTask = pdfjs.getDocument(url);
        const doc = await loadingTask.promise;
        if (!cancelled) {
          setPdf(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        }
      } catch (err) {
        console.error('[PdfViewer] Failed to load PDF:', err);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // Render page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    (async () => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    onProgress?.(Math.round((pageNum / numPages) * 100));
  }, [pdf, pageNum, scale, numPages]);

  const goPage = (delta: number) => setPageNum(p => Math.max(1, Math.min(numPages, p + delta)));

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!fullscreen) containerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
    setFullscreen(!fullscreen);
  };

  if (loading) {
    return (
      <div className={clsx('flex items-center justify-center py-20', className)}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={clsx('flex items-center justify-center py-20', className)}>
        <div className="text-center">
          <FileText className="w-10 h-10 text-[var(--text-secondary)] opacity-30 mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">Impossible de charger le document</p>
          <a href={url} target="_blank" rel="noopener" className="text-xs text-brand-navy dark:text-brand-gold hover:underline mt-2 inline-block">
            Télécharger le fichier
          </a>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={clsx('flex flex-col bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-surface-dark-card border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button onClick={() => goPage(-1)} disabled={pageNum <= 1} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-[var(--text-primary)] min-w-[80px] text-center">
            {pageNum} / {numPages}
          </span>
          <button onClick={() => goPage(1)} disabled={pageNum >= numPages} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-[var(--text-secondary)] w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ml-2">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <a href={url} download className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex justify-center p-2 sm:p-4 min-h-[calc(100vh-10rem)]">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio Player
// ---------------------------------------------------------------------------

function AudioPlayer({ url, filename }: { url: string; filename?: string }) {
  return (
    <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-brand-navy/10 dark:bg-brand-gold/20 flex items-center justify-center">
          <Volume2 className="w-6 h-6 text-brand-navy dark:text-brand-gold" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{filename || 'Fichier audio'}</p>
          <p className="text-xs text-[var(--text-secondary)]">Lecteur audio</p>
        </div>
      </div>
      <audio controls className="w-full" preload="metadata">
        <source src={url} />
        Votre navigateur ne supporte pas la lecture audio.
      </audio>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HTML Viewer (sandboxed iframe)
// ---------------------------------------------------------------------------

function HtmlViewer({ url }: { url: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)]">
      <iframe
        src={url}
        className="w-full min-h-[calc(100vh-10rem)] bg-white"
        sandbox="allow-same-origin allow-scripts"
        title="Contenu HTML"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DocumentViewer({ url, pdfPreviewUrl, mimeType, filename, onProgress, className }: DocumentViewerProps) {
  const viewUrl = pdfPreviewUrl || url;
  const type = mimeType || '';

  // PDF or converted Office documents
  if (type === 'application/pdf' || pdfPreviewUrl) {
    return <PdfViewer url={viewUrl} onProgress={onProgress} className={className} />;
  }

  // Audio
  if (type.startsWith('audio/')) {
    return <AudioPlayer url={url} filename={filename} />;
  }

  // Video (already handled by lesson player, but fallback)
  if (type.startsWith('video/')) {
    return (
      <div className={clsx('rounded-xl overflow-hidden', className)}>
        <video controls className="w-full" preload="metadata">
          <source src={url} type={type} />
        </video>
      </div>
    );
  }

  // HTML
  if (type === 'text/html') {
    return <HtmlViewer url={url} />;
  }

  // Office without conversion — show download link
  if (type.includes('officedocument') || type.includes('opendocument')) {
    return (
      <div className={clsx('flex flex-col items-center justify-center py-16 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]', className)}>
        <FileText className="w-12 h-12 text-[var(--text-secondary)] opacity-30 mb-3" />
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{filename || 'Document'}</p>
        <p className="text-xs text-[var(--text-secondary)] mb-4">Ce document n'a pas pu être converti en aperçu</p>
        <a
          href={url}
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy-deep"
        >
          <Download className="w-4 h-4" /> Télécharger
        </a>
      </div>
    );
  }

  // Fallback: download link
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16', className)}>
      <FileText className="w-10 h-10 text-[var(--text-secondary)] opacity-30 mb-3" />
      <a href={url} download className="text-sm text-brand-navy dark:text-brand-gold hover:underline flex items-center gap-1">
        <Download className="w-4 h-4" /> Télécharger le fichier
      </a>
    </div>
  );
}
