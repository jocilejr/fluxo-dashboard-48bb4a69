import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

interface Props {
  url: string;
  themeColor: string;
  preloadedPdf?: pdfjsLib.PDFDocumentProxy | null;
}

export default function PdfViewer({ url, themeColor, preloadedPdf }: Props) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(2); // index 2 = 1x (fit)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseFitScaleRef = useRef(1);

  useEffect(() => {
    if (preloadedPdf) {
      setPdf(preloadedPdf);
      setTotalPages(preloadedPdf.numPages);
      setCurrentPage(1);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    pdfjsLib
      .getDocument({ url, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true })
      .promise.then((doc) => {
        if (cancelled) return;
        setPdf(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o PDF.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url, preloadedPdf]);

  const renderPage = useCallback(async (pageNum: number, zoomMultiplier: number) => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    const page = await pdf.getPage(pageNum);
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32;

    if (containerWidth <= 0) {
      requestAnimationFrame(() => renderPage(pageNum, zoomMultiplier));
      return;
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = containerWidth / baseViewport.width;
    baseFitScaleRef.current = fitScale;

    const userScale = fitScale * zoomMultiplier;
    const dpr = window.devicePixelRatio || 1;
    const renderScale = userScale * dpr;
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const cssWidth = baseViewport.width * userScale;
    const cssHeight = baseViewport.height * userScale;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }, [pdf]);

  const zoomMultiplier = ZOOM_LEVELS[zoomIndex];

  useEffect(() => {
    if (pdf && currentPage) renderPage(currentPage, zoomMultiplier);
  }, [pdf, currentPage, zoomMultiplier, renderPage]);

  const zoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  const zoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0));
  const resetZoom = () => setZoomIndex(2);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: themeColor }} />
        <p className="text-lg font-medium">Carregando PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive text-lg font-medium p-8 text-center">
        {error}
      </div>
    );
  }

  const zoomPercent = Math.round(zoomMultiplier * 100);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-2 px-3 border-b border-border bg-muted/30 shrink-0 flex-wrap">
        {/* Page navigation */}
        {totalPages > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="h-10 px-3 text-sm font-semibold gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-sm font-bold min-w-[80px] text-center" style={{ color: themeColor }}>
              {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="h-10 px-3 text-sm font-semibold gap-1.5"
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Divider */}
        {totalPages > 1 && (
          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={zoomIndex <= 0}
            onClick={zoomOut}
            className="h-10 w-10 p-0"
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            onClick={resetZoom}
            className="text-xs font-bold min-w-[50px] text-center rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
            title="Restaurar zoom"
            style={{ color: themeColor }}
          >
            {zoomPercent}%
          </button>
          <Button
            variant="outline"
            size="sm"
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            onClick={zoomIn}
            className="h-10 w-10 p-0"
            title="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          {zoomIndex !== 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              className="h-10 w-10 p-0"
              title="Restaurar tamanho original"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* PDF canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center items-start p-4 bg-muted/20">
        <canvas ref={canvasRef} className="shadow-lg rounded-lg" />
      </div>
    </div>
  );
}
