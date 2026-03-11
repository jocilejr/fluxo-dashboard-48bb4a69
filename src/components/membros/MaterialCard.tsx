import { useState } from "react";
import { FileText, Video, Music, Image, ExternalLink, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const typeIcons: Record<string, typeof FileText> = {
  text: FileText,
  pdf: FileText,
  video: Video,
  audio: Music,
  image: Image,
  link: ExternalLink,
};

export default function MaterialCard({ material, themeColor }: Props) {
  const [open, setOpen] = useState(false);
  const Icon = typeIcons[material.content_type] || FileText;

  const handleOpen = () => {
    if (material.content_type === "text") {
      setOpen(true);
    } else if (material.content_type === "pdf" || material.content_type === "link") {
      window.open(material.content_url || "#", "_blank");
    } else if (material.content_type === "image") {
      setOpen(true);
    } else if (material.content_type === "video" || material.content_type === "audio") {
      setOpen(true);
    }
  };

  return (
    <>
      <Card
        className="flex items-center gap-3 p-3 cursor-pointer hover:shadow-md transition-all border-amber-100 hover:border-amber-300 group"
        onClick={handleOpen}
      >
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${themeColor}15` }}
        >
          <Icon className="h-5 w-5" style={{ color: themeColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-800 truncate">{material.title}</p>
          {material.description && (
            <p className="text-xs text-muted-foreground truncate">{material.description}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="h-4 w-4" />
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" style={{ color: themeColor }} />
              {material.title}
            </DialogTitle>
          </DialogHeader>

          {material.content_type === "text" && material.content_text && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-gray-700 bg-amber-50/50 rounded-lg p-6 border border-amber-100">
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
            <div className="bg-amber-50/50 rounded-lg p-6 flex flex-col items-center gap-4">
              <Music className="h-12 w-12 text-amber-600" />
              <audio src={material.content_url} controls className="w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
