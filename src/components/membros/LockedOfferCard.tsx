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

  return (
    <>
      {/* Horizontal card — same structure as product cards but locked style */}
      <button
        className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 text-left active:scale-[0.98]"
        onClick={() => setDialogOpen(true)}
      >
        {/* Square image with lock overlay */}
        <div className="relative shrink-0">
          {offer.image_url ? (
            <img
              src={offer.image_url}
              alt={offer.name}
              className="h-16 w-16 rounded-xl object-cover opacity-70 grayscale-[30%]"
            />
          ) : (
            <div
              className="h-16 w-16 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${themeColor}12, ${themeColor}06)` }}
            >
              <Lock className="h-6 w-6" style={{ color: `${themeColor}80` }} />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
            <Lock className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-[15px] leading-tight truncate">{offer.name}</h3>
          {offer.category_tag && (
            <span
              className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: `${themeColor}cc` }}
            >
              {offer.category_tag}
            </span>
          )}
          <span className="flex items-center gap-1 mt-1 text-[11px] font-semibold" style={{ color: themeColor }}>
            <Sparkles className="h-3 w-3" />
            Toque para saber mais
          </span>
        </div>
      </button>

      {/* Clean light popup */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-gray-100 p-0 overflow-hidden bg-white shadow-xl">
          {/* Offer image */}
          {offer.image_url && (
            <div className="h-48 overflow-hidden">
              <img
                src={offer.image_url}
                alt={offer.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="px-6 pb-6 space-y-4" style={{ paddingTop: offer.image_url ? "16px" : "24px" }}>
            {/* Title */}
            <div>
              <h2 className="text-lg font-bold text-gray-800">{offer.name}</h2>
              {offer.category_tag && (
                <span
                  className="inline-block mt-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: `${themeColor}cc` }}
                >
                  {offer.category_tag}
                </span>
              )}
            </div>

            {/* AI personalized message or description */}
            {aiMessage ? (
              <p className="text-sm text-gray-600 leading-relaxed">{aiMessage}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {offer.description || `${offer.name} é um conteúdo exclusivo preparado para complementar sua jornada.`}
                </p>
                {ownedProductNames && ownedProductNames.length > 0 && (
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Você já desbloqueou{" "}
                    <span className="font-semibold text-gray-700">
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
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-100"
                  >
                    ✓ {name}
                  </span>
                ))}
              </div>
            )}

            {/* Price */}
            {offer.price && (
              <p className="text-lg font-bold text-gray-800">
                R$ {offer.price.toFixed(2).replace(".", ",")}
              </p>
            )}

            {/* CTA */}
            {offer.purchase_url && (
              <Button
                className="w-full h-12 rounded-xl font-bold text-white text-sm tracking-wide border-0"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                  boxShadow: `0 4px 15px ${themeColor}30`,
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
