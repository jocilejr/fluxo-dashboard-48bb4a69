import { useState } from "react";
import { Lock, ExternalLink, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  purchase_url: string;
  price: number | null;
  category_tag: string | null;
}

interface Props {
  offer: Offer;
  themeColor: string;
  aiMessage?: string;
  ownedProductNames?: string[];
}

export default function LockedOfferCard({ offer, themeColor, aiMessage, ownedProductNames }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasImage = !!offer.image_url;

  return (
    <>
      {/* Netflix-style card — image dominant, desirable */}
      <div
        className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-400 group relative"
        style={{
          background: hasImage ? "transparent" : "rgba(255,255,255,0.04)",
          border: `1px solid ${themeColor}20`,
          boxShadow: `0 0 20px ${themeColor}08`,
        }}
        onClick={() => setDialogOpen(true)}
      >
        {hasImage ? (
          <div className="relative h-44 overflow-hidden">
            <img
              src={offer.image_url!}
              alt={offer.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Dark gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(0deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.4) 50%, rgba(15,23,42,0.2) 100%)`,
              }}
            />

            {/* Category tag */}
            {offer.category_tag && (
              <div
                className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: `${themeColor}cc` }}
              >
                {offer.category_tag}
              </div>
            )}

            {/* Lock icon */}
            <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Lock className="h-3.5 w-3.5 text-white/80" />
            </div>

            {/* Bottom content over image */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
              <h3 className="font-bold text-white text-base leading-tight">{offer.name}</h3>
              {offer.description && (
                <p className="text-white/60 text-xs mt-1 line-clamp-1">{offer.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2.5">
                <div
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white flex items-center gap-1.5"
                  style={{ backgroundColor: themeColor }}
                >
                  <Sparkles className="h-3 w-3" />
                  Saiba mais
                </div>
                {offer.price && (
                  <span className="text-white/50 text-xs">
                    R$ {offer.price.toFixed(2).replace(".", ",")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* No-image variant — still premium */
          <div className="px-4 py-4 flex items-center gap-3.5">
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${themeColor}25, ${themeColor}10)`,
                border: `1px solid ${themeColor}20`,
              }}
            >
              <Lock className="h-5 w-5" style={{ color: themeColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white/90 text-sm truncate">{offer.name}</h3>
              {offer.description && (
                <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{offer.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5">
                <Sparkles className="h-3 w-3" style={{ color: themeColor }} />
                <span className="text-[11px] font-semibold" style={{ color: themeColor }}>
                  Toque para descobrir
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Glow effect on hover */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 30px ${themeColor}10, 0 0 30px ${themeColor}10`,
          }}
        />
      </div>

      {/* Premium dark popup */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-md rounded-3xl border-0 p-0 overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
            boxShadow: `0 0 60px ${themeColor}15, 0 25px 50px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Offer image in popup */}
          {offer.image_url && (
            <div className="relative h-48 overflow-hidden">
              <img
                src={offer.image_url}
                alt={offer.name}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(0deg, #0f172a 0%, transparent 60%)`,
                }}
              />
            </div>
          )}

          <div className="px-6 pb-6 space-y-4" style={{ paddingTop: offer.image_url ? "0" : "24px" }}>
            {/* Title */}
            <div>
              <h2 className="text-lg font-bold text-white">{offer.name}</h2>
              {offer.category_tag && (
                <span
                  className="inline-block mt-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: `${themeColor}cc` }}
                >
                  {offer.category_tag}
                </span>
              )}
            </div>

            {/* AI personalized message */}
            {aiMessage ? (
              <p className="text-sm text-slate-300 leading-relaxed">{aiMessage}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {offer.description || `${offer.name} é um conteúdo exclusivo preparado para complementar sua jornada.`}
                </p>
                {ownedProductNames && ownedProductNames.length > 0 && (
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Você já desbloqueou{" "}
                    <span className="font-semibold text-white/80">
                      {ownedProductNames.join(" e ")}
                    </span>
                    . Este material complementa perfeitamente o que você já está praticando.
                  </p>
                )}
              </div>
            )}

            {/* Owned products badges */}
            {ownedProductNames && ownedProductNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ownedProductNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-slate-400 border border-white/8"
                  >
                    ✓ {name}
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            {offer.purchase_url && (
              <Button
                className="w-full h-12 rounded-xl font-bold text-white text-sm tracking-wide border-0"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                  boxShadow: `0 4px 20px ${themeColor}40`,
                }}
                onClick={() => window.open(offer.purchase_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Quero desbloquear
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
