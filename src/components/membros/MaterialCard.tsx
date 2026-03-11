import { useState } from "react";
import { FileText, Video, Music, Image, ExternalLink, Eye, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Material {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
}

interface Props {
  material: Material;
  themeColor: string;
}

const typeConfig: Record<string, { icon: typeof FileText; label: string }> = {
  text: { icon: FileText, label: "Texto" },
  pdf: { icon: FileText, label: "PDF" },
  video: { icon: Video, label: "Vídeo" },
  audio: { icon: Music, label: "Áudio" },
  image: { icon: Image, label: "Imagem" },
  link: { icon: ExternalLink, label: "Link" },
};

export default function MaterialCard({ material, themeColor }: Props) {
  const [open, setOpen] = useState(false);
  const config = typeConfig[material.content_type] || typeConfig.text;
  const Icon = config.icon;

  const handleOpen = () => {
    if (material.content_type === "pdf" || material.content_type === "link") {
      window.open(material.content_url || "#", "_blank");
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="group relative flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 text-center min-h-[120px] justify-center"
      >
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${themeColor}12` }}
        >
          <Icon className="h-6 w-6" style={{ color: themeColor }} />
        </div>
        <p className="font-medium text-sm text-gray-800 leading-tight line-clamp-2">{material.title}</p>
        <Badge variant="secondary" className="text-[10px] px-2 py-0 opacity-60">
          {config.label}
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" style={{ color: themeColor }} />
              {material.title}
            </DialogTitle>
          </DialogHeader>

          {material.content_type === "text" && material.content_text && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-gray-700 rounded-lg p-6 border" style={{ backgroundColor: `${themeColor}08`, borderColor: `${themeColor}20` }}>
              {material.content_text}
            </div>
          )}

          {material.content_type === "image" && material.content_url && (
            <img src={material.content_url} alt={material.title} className="w-full rounded-lg" />
          )}

          {material.content_type === "video" && material.content_url && (
            <div className="aspect-video">
              {material.content_url.includes("youtube") || material.content_url.includes("youtu.be") ? (
                <iframe
                  src={material.content_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={material.content_url} controls className="w-full h-full rounded-lg" />
              )}
            </div>
          )}

          {material.content_type === "audio" && material.content_url && (
            <div className="rounded-lg p-6 flex flex-col items-center gap-4" style={{ backgroundColor: `${themeColor}08` }}>
              <Music className="h-12 w-12" style={{ color: themeColor }} />
              <audio src={material.content_url} controls className="w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
