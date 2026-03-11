import { useState, useRef, useEffect } from "react";
import { Lock, ExternalLink, Heart } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import meirePhoto from "@/assets/meire-rosana.png";

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
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const pitchCache = useRef<Record<string, string[]>>({});

  // Sequential message reveal
  useEffect(() => {
    if (aiMessages.length === 0) return;
    if (visibleCount >= aiMessages.length) return;
    
    const timer = setTimeout(() => {
      setVisibleCount(prev => prev + 1);
    }, visibleCount === 0 ? 600 : 1200);
    
    return () => clearTimeout(timer);
  }, [aiMessages, visibleCount]);

  const handleOpen = async () => {
    setDialogOpen(true);
    setVisibleCount(0);

    if (pitchCache.current[offer.id]) {
      setAiMessages(pitchCache.current[offer.id]);
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

      if (!error && data?.messages && Array.isArray(data.messages)) {
        setAiMessages(data.messages);
        pitchCache.current[offer.id] = data.messages;
      } else if (!error && data?.message) {
        // Fallback for single message
        const msgs = [data.message];
        setAiMessages(msgs);
        pitchCache.current[offer.id] = msgs;
      }
    } catch {}
    setAiLoading(false);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setVisibleCount(0);
  };

  return (
    <>
      {/* Card externo — mais atrativo */}
      <button
        className="w-full rounded-2xl p-[1px] transition-all duration-300 active:scale-[0.98] hover:shadow-lg"
        style={{ background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}15)` }}
        onClick={handleOpen}
      >
        <div className="flex items-center gap-4 bg-white rounded-2xl p-4">
          <div className="relative shrink-0">
            {offer.image_url ? (
              <img
                src={offer.image_url}
                alt={offer.name}
                className="h-16 w-16 rounded-xl object-cover"
                style={{ border: `2px solid ${themeColor}30` }}
              />
            ) : (
              <div
                className="h-16 w-16 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}
              >
                <Heart className="h-6 w-6" style={{ color: themeColor }} />
              </div>
            )}
            <div
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm"
              style={{ backgroundColor: themeColor }}
            >
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
            <span
              className="flex items-center gap-1.5 mt-1.5 text-[12px] font-semibold"
              style={{ color: themeColor }}
            >
              <Heart className="h-3 w-3" fill={themeColor} />
              Conheça mais
            </span>
          </div>
        </div>
      </button>

      {/* Dialog — mini-chat da Meire Rosana */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 p-0 overflow-hidden bg-gray-50 shadow-2xl">
          {/* Header compacto */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ background: `linear-gradient(135deg, ${themeColor}12, ${themeColor}06)` }}
          >
            <img
              src={meirePhoto}
              alt="Meire Rosana"
              className="h-10 w-10 rounded-full object-cover shadow-sm"
              style={{ border: `2px solid ${themeColor}40` }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">Meire Rosana</p>
              {aiLoading && (
                <p className="text-[11px] font-medium" style={{ color: themeColor }}>digitando...</p>
              )}
            </div>
            {/* Small product image */}
            {offer.image_url && (
              <img
                src={offer.image_url}
                alt={offer.name}
                className="h-10 w-10 rounded-lg object-cover shadow-sm"
              />
            )}
          </div>

          {/* Chat area */}
          <div className="px-4 py-4 space-y-2.5 min-h-[180px]">
            {aiLoading && visibleCount === 0 && (
              <div className="flex items-start gap-2">
                <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover mt-0.5 shrink-0" />
                <div
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-md w-fit"
                  style={{ backgroundColor: `${themeColor}10` }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "0ms" }} />
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "150ms" }} />
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {aiMessages.slice(0, visibleCount).map((msg, i) => (
              <div key={i} className="flex items-start gap-2 animate-fade-in">
                {i === 0 ? (
                  <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover mt-0.5 shrink-0" />
                ) : (
                  <div className="h-7 w-7 shrink-0" />
                )}
                <div
                  className="px-4 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed max-w-[85%]"
                  style={{ backgroundColor: `${themeColor}10` }}
                >
                  {msg}
                </div>
              </div>
            ))}

            {/* Typing indicator between messages */}
            {visibleCount > 0 && visibleCount < aiMessages.length && (
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 shrink-0" />
                <div
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-md w-fit"
                  style={{ backgroundColor: `${themeColor}08` }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}60`, animationDelay: "0ms" }} />
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}60`, animationDelay: "150ms" }} />
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}60`, animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {/* Fallback if no AI */}
            {!aiLoading && aiMessages.length === 0 && (
              <div className="flex items-start gap-2">
                <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover mt-0.5 shrink-0" />
                <div
                  className="px-4 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed max-w-[85%]"
                  style={{ backgroundColor: `${themeColor}10` }}
                >
                  {offer.description || `${offer.name} é um material muito especial que preparamos com carinho. ❤️`}
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          {offer.purchase_url && visibleCount >= aiMessages.length && !aiLoading && (
            <div className="px-5 pb-5 pt-1 animate-fade-in">
              <Button
                className="w-full h-12 rounded-xl font-bold text-white text-sm tracking-wide border-0"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                  boxShadow: `0 4px 15px ${themeColor}30`,
                }}
                onClick={() => window.open(offer.purchase_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Quero conhecer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
