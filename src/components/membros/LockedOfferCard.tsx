import { useState, useRef } from "react";
import { Lock, ExternalLink, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  purchase_url: string;
  price: number | null;
  category_tag: string | null;
}

interface MemberProfile {
  memberSince: string | null;
  totalPaid: number;
  totalTransactions: number;
  totalProducts: number;
  daysSinceLastAccess: number | null;
}

interface Props {
  offer: Offer;
  themeColor: string;
  ownedProductNames?: string[];
  firstName?: string;
  memberProfile?: MemberProfile | null;
}

export default function LockedOfferCard({ offer, themeColor, ownedProductNames, firstName, memberProfile }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const pitchCache = useRef<Record<string, string>>({});

  const handleOpen = async () => {
    setDialogOpen(true);

    // Check cache
    if (pitchCache.current[offer.id]) {
      setAiMessage(pitchCache.current[offer.id]);
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("member-offer-pitch", {
        body: {
          firstName: firstName || "Querido(a)",
          offerName: offer.name,
          offerDescription: offer.description,
          ownedProductNames,
          profile: memberProfile,
        },
      });

      if (!error && data?.message) {
        setAiMessage(data.message);
        pitchCache.current[offer.id] = data.message;
      }
    } catch {}
    setAiLoading(false);
  };

  return (
    <>
      <button
        className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 text-left active:scale-[0.98]"
        onClick={handleOpen}
      >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-gray-100 p-0 overflow-hidden bg-white shadow-xl">
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

            {/* AI pitch or loading */}
            {aiLoading ? (
              <div className="flex items-center gap-2 py-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "0ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "150ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "300ms" }} />
                <span className="text-xs font-medium ml-1" style={{ color: themeColor }}>preparando algo especial...</span>
              </div>
            ) : aiMessage ? (
              <p className="text-sm text-gray-600 leading-relaxed">{aiMessage}</p>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                {offer.description || `${offer.name} é um conteúdo exclusivo preparado para complementar sua jornada.`}
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
