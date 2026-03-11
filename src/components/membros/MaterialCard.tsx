import { useState, useRef, useCallback, lazy, Suspense } from "react";
import { FileText, Video, Image, Download, ExternalLink, ArrowLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";

const PdfViewerLazy = lazy(() => import("./PdfViewer"));
import PdfViewer from "./PdfViewer";
import { Button } from "@/components/ui/button";

interface Material {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  button_label?: string | null;
}

interface Props {
  material: Material;
  themeColor: string;
  preloadedPdf?: pdfjsLib.PDFDocumentProxy | null;
  phone?: string;
}

const typeConfig: Record<string, { icon: typeof FileText; label: string; accent: string }> = {
  text: { icon: FileText, label: "Texto", accent: "#6366f1" },
  pdf: { icon: Download, label: "PDF", accent: "#ef4444" },
  video: { icon: Video, label: "Vídeo", accent: "#8b5cf6" },
  image: { icon: Image, label: "Imagem", accent: "#10b981" },
};

export default function MaterialCard({ material, themeColor, preloadedPdf, phone }: Props) {
  const [open, setOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const config = typeConfig[material.content_type] || typeConfig.text;
  const Icon = config.icon;
  const videoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = () => {
    if (material.content_type === "pdf") {
      setPdfOpen(true);
    } else {
      setOpen(true);
    }
  };

  const saveVideoProgress = useCallback((seconds: number, duration: number) => {
    if (!phone || !material.id) return;
    if (videoSaveTimer.current) clearTimeout(videoSaveTimer.current);
    videoSaveTimer.current = setTimeout(async () => {
      try {
        await supabase.from("member_content_progress").upsert({
          normalized_phone: phone,
          material_id: material.id,
          progress_type: "video",
          video_seconds: Math.floor(seconds),
          video_duration: Math.floor(duration),
          last_accessed_at: new Date().toISOString(),
        }, { onConflict: "normalized_phone,material_id" });
      } catch {}
    }, 3000);
  }, [phone, material.id]);

  const handleVideoTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    saveVideoProgress(video.currentTime, video.duration || 0);
  }, [saveVideoProgress]);

  const renderPdfViewer = () => {
    if (preloadedPdf) {
      return <PdfViewer url={material.content_url || ""} themeColor={themeColor} preloadedPdf={preloadedPdf} phone={phone} materialId={material.id} />;
    }
    return (
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      }>
        <PdfViewerLazy url={material.content_url || ""} themeColor={themeColor} phone={phone} materialId={material.id} />
      </Suspense>
    );
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="group relative w-full text-left rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all duration-300 group-hover:w-1.5" style={{ backgroundColor: config.accent }} />
        
        <div className="pl-5 pr-4 py-4 flex items-start gap-3.5">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${config.accent}10` }}
          >
            <Icon className="h-5 w-5" style={{ color: config.accent }} />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-semibold text-sm text-gray-800 leading-snug line-clamp-2 group-hover:text-gray-600 transition-colors">
              {material.title}
            </p>
            {material.description && (
              <p className="text-xs text-gray-500 line-clamp-1">{material.description}</p>
            )}
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${config.accent}12`, color: config.accent }}
            >
              {config.label}
            </span>
          </div>
        </div>
      </button>

      {/* PDF fullscreen dialog */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="w-[98vw] max-w-[98vw] h-[95vh] max-h-[95vh] flex flex-col p-0 overflow-hidden gap-0 bg-white [&>button:last-child]:hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-4 shrink-0 bg-white">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setPdfOpen(false)}
              className="text-lg gap-2 px-5 py-3 h-auto font-semibold text-gray-800 hover:bg-gray-100"
            >
              <ArrowLeft className="h-6 w-6" />
              Voltar
            </Button>
            <h2 className="text-lg font-bold truncate text-gray-800">{material.title}</h2>
          </div>
          {renderPdfViewer()}
        </DialogContent>
      </Dialog>

      {/* Standard dialog for text/video/image */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 bg-white">
          <div className="px-6 pt-6 pb-4 border-b border-gray-200" style={{ background: `linear-gradient(135deg, ${config.accent}08, ${config.accent}04)` }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg text-gray-800">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accent}15` }}>
                  <Icon className="h-4.5 w-4.5" style={{ color: config.accent }} />
                </div>
                {material.title}
              </DialogTitle>
              {material.description && (
                <p className="text-sm text-gray-500 mt-1 pl-12">{material.description}</p>
              )}
            </DialogHeader>
          </div>

          <div className="p-6">
            {material.content_type === "text" && (
              <div className="space-y-5">
                {material.content_text && (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-gray-700 rounded-xl p-6 border border-gray-200 bg-gray-50">
                    {material.content_text}
                  </div>
                )}
                {material.content_url && (
                  <Button
                    className="w-full gap-2 text-white"
                    style={{ backgroundColor: themeColor }}
                    onClick={() => window.open(material.content_url!, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {material.button_label || "Acessar"}
                  </Button>
                )}
              </div>
            )}

            {material.content_type === "image" && material.content_url && (
              <img src={material.content_url} alt={material.title} className="w-full rounded-xl shadow-sm" />
            )}

            {material.content_type === "video" && material.content_url && (
              <div className="aspect-video rounded-xl overflow-hidden shadow-sm">
                {material.content_url.includes("youtube") || material.content_url.includes("youtu.be") ? (
                  <iframe
                    src={material.content_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={material.content_url}
                    controls
                    className="w-full h-full"
                    onTimeUpdate={handleVideoTimeUpdate}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
