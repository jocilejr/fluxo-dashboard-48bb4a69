import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, [url]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    const page = await pdf.getPage(pageNum);
    const container = containerRef.current;
    const containerWidth = container.clientWidth;

    // Scale to fit container width, cap at 2x for sharpness
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min((containerWidth / baseViewport.width), 2);
    const viewport = page.getViewport({ scale });

    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / (window.devicePixelRatio > 1 ? scale / (containerWidth / baseViewport.width) : 1)}px`;
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }, [pdf]);

  useEffect(() => {
    if (pdf && currentPage) renderPage(currentPage);
  }, [pdf, currentPage, renderPage]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Navigation bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-3 px-4 border-b border-border bg-muted/30 shrink-0">
          <Button
            variant="outline"
            size="lg"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="h-12 px-5 text-base font-semibold gap-2"
          >
            <ChevronLeft className="h-5 w-5" />
            Anterior
          </Button>
          <span className="text-base font-bold min-w-[100px] text-center" style={{ color: themeColor }}>
            {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="lg"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="h-12 px-5 text-base font-semibold gap-2"
          >
            Próxima
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* PDF canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4 bg-muted/20">
        <canvas ref={canvasRef} className="shadow-lg rounded-lg" />
      </div>
    </div>
  );
}
