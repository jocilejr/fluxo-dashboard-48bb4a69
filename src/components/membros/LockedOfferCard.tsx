import { useState } from "react";
import { Lock, ShoppingBag, ChevronDown, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      {/* Card — visually identical to product cards but locked */}
      <div
        className="rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer relative"
        style={{ borderLeft: `4px solid ${themeColor}60` }}
        onClick={() => setDialogOpen(true)}
      >
        <div className="w-full px-4 py-3.5 flex items-center gap-3">
          {/* Logo/Image — grayscale */}
          {offer.image_url ? (
            <img
              src={offer.image_url}
              alt={offer.name}
              className="h-12 w-12 rounded-xl object-cover shrink-0 shadow-sm grayscale opacity-60"
            />
          ) : (
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 opacity-60"
              style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}
            >
              <ShoppingBag className="h-5 w-5" style={{ color: themeColor }} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-700 text-sm truncate">{offer.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Lock className="h-3 w-3 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-400">Contribua para liberar</span>
            </div>
          </div>

          <ChevronDown className="h-4 w-4 text-slate-300 shrink-0" />
        </div>
      </div>

      {/* Popup Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: themeColor }} />
              {offer.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Offer image */}
            {offer.image_url && (
              <img
                src={offer.image_url}
                alt={offer.name}
                className="w-full h-40 object-cover rounded-xl"
              />
            )}

            {/* AI personalized message */}
            {aiMessage ? (
              <p className="text-sm text-slate-600 leading-relaxed">{aiMessage}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Este é um material especial, mas você ainda não contribuiu para recebê-lo.
                </p>
                {ownedProductNames && ownedProductNames.length > 0 && (
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Até agora, você contribuiu com{" "}
                    <span className="font-semibold text-slate-700">
                      {ownedProductNames.join(" e ")}
                    </span>
                    , que são incríveis! Para desbloquear <span className="font-semibold">{offer.name}</span>, contribua pelo link abaixo.
                  </p>
                )}
              </div>
            )}

            {/* CTA */}
            {offer.purchase_url && (
              <Button
                className="w-full rounded-xl font-semibold"
                style={{ backgroundColor: themeColor }}
                onClick={() => window.open(offer.purchase_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Contribuir para liberar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
