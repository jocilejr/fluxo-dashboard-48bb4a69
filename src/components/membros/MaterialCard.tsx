import { useState } from "react";
import { FileText, Video, Image, Download, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
}

const typeConfig: Record<string, { icon: typeof FileText; label: string; accent: string }> = {
  text: { icon: FileText, label: "Texto", accent: "#6366f1" },
  pdf: { icon: Download, label: "PDF", accent: "#ef4444" },
  video: { icon: Video, label: "Vídeo", accent: "#8b5cf6" },
  image: { icon: Image, label: "Imagem", accent: "#10b981" },
};

export default function MaterialCard({ material, themeColor }: Props) {
  const [open, setOpen] = useState(false);
  const config = typeConfig[material.content_type] || typeConfig.text;
  const Icon = config.icon;

  const handleOpen = () => {
    if (material.content_type === "pdf") {
      window.open(material.content_url || "#", "_blank");
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="group relative w-full text-left rounded-xl bg-card border border-border shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
      >
        {/* Left accent border */}
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all duration-300 group-hover:w-1.5" style={{ backgroundColor: config.accent }} />
        
        <div className="pl-5 pr-4 py-4 flex items-start gap-3.5">
          {/* Icon */}
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${config.accent}10` }}
          >
            <Icon className="h-5 w-5" style={{ color: config.accent }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2 group-hover:text-muted-foreground transition-colors">
              {material.title}
            </p>
            {material.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{material.description}</p>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          {/* Colored header */}
          <div className="px-6 pt-6 pb-4 border-b border-border" style={{ background: `linear-gradient(135deg, ${config.accent}08, ${config.accent}04)` }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accent}15` }}>
                  <Icon className="h-4.5 w-4.5" style={{ color: config.accent }} />
                </div>
                {material.title}
              </DialogTitle>
              {material.description && (
                <p className="text-sm text-muted-foreground mt-1 pl-12">{material.description}</p>
              )}
            </DialogHeader>
          </div>

          <div className="p-6">
            {material.content_type === "text" && (
              <div className="space-y-5">
                {material.content_text && (
                  <div
                    className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground rounded-xl p-6 border border-border bg-muted/50"
                  >
                    {material.content_text}
                  </div>
                )}
                {material.content_url && (
                  <Button
                    className="w-full gap-2"
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
                  <video src={material.content_url} controls className="w-full h-full" />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
