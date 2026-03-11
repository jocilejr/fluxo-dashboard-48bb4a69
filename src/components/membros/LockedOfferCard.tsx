import { useState, useRef, useEffect, useCallback } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PaymentFlow from "./PaymentFlow";
import meirePhoto from "@/assets/meire-rosana.png";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  purchase_url: string;
  price: number | null;
  category_tag: string | null;
  pix_key?: string | null;
  card_payment_url?: string | null;
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

const CONTEXTUAL_LABELS = [
  "Aprofunde seus estudos",
  "Complementa seu material",
  "Continue sua jornada",
  "Recomendado para você",
  "Material complementar",
];

function getContextLabel(offer: Offer, index?: number): string {
  if (offer.category_tag) return offer.category_tag;
  const i = index ?? Math.floor(Math.random() * CONTEXTUAL_LABELS.length);
  return CONTEXTUAL_LABELS[i % CONTEXTUAL_LABELS.length];
}

export default function LockedOfferCard({ offer, themeColor, ownedProductNames, firstName, memberProfile }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showDots, setShowDots] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const pitchCache = useRef<Record<string, string[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleCount, showDots]);

  useEffect(() => {
    if (aiMessages.length === 0 || visibleCount >= aiMessages.length) return;
    setShowDots(true);
    const t = setTimeout(() => {
      setShowDots(false);
      setVisibleCount(prev => prev + 1);
    }, visibleCount === 0 ? 400 : 900);
    return () => clearTimeout(t);
  }, [aiMessages, visibleCount]);

  useEffect(() => {
    if (aiMessages.length > 0 && visibleCount >= aiMessages.length && !aiLoading) {
      const t = setTimeout(() => setCtaVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, [visibleCount, aiMessages.length, aiLoading]);

  const handleOpen = useCallback(async () => {
    setDialogOpen(true);
    setVisibleCount(0);
    setCtaVisible(false);
    setShowDots(true);

    if (pitchCache.current[offer.id]) {
      setAiMessages(pitchCache.current[offer.id]);
      setAiLoading(false);
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
        const msgs = [data.message];
        setAiMessages(msgs);
        pitchCache.current[offer.id] = msgs;
      }
    } catch {}
    setAiLoading(false);
  }, [offer, firstName, ownedProductNames, memberProfile]);

  const handleClose = () => {
    setDialogOpen(false);
    setVisibleCount(0);
    setShowDots(false);
    setCtaVisible(false);
  };

  const label = getContextLabel(offer);

  return (
    <>
      {/* Redesigned card — banner style */}
      <button
        className="w-full rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 text-left active:scale-[0.98] group relative"
        style={{
          border: `1.5px dashed ${themeColor}40`,
        }}
        onClick={handleOpen}
      >
        {/* Image or gradient banner */}
        {offer.image_url ? (
          <div className="relative h-[90px] w-full overflow-hidden">
            <img
              src={offer.image_url}
              alt={offer.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute top-2.5 right-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-white/90 bg-black/40 backdrop-blur-sm">
                <Lock className="h-2.5 w-2.5" />
                Exclusivo
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/90 mb-1.5"
                style={{ backgroundColor: `${themeColor}90` }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {label}
              </span>
              <h3 className="font-extrabold text-white text-[15px] leading-tight drop-shadow-sm truncate">
                {offer.name}
              </h3>
            </div>
          </div>
        ) : (
          <div
            className="relative h-[80px] w-full flex flex-col justify-end p-3"
            style={{
              background: `linear-gradient(135deg, ${themeColor}18 0%, ${themeColor}08 50%, ${themeColor}15 100%)`,
            }}
          >
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                <Lock className="h-2.5 w-2.5" />
                Exclusivo
              </span>
            </div>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white w-fit mb-1.5"
              style={{ backgroundColor: themeColor }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {label}
            </span>
            <h3 className="font-extrabold text-gray-800 text-[15px] leading-tight truncate">
              {offer.name}
            </h3>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-3 py-2.5 bg-white flex items-center justify-between gap-2">
          {offer.description ? (
            <p className="text-[12px] text-gray-500 leading-snug truncate flex-1">
              {offer.description}
            </p>
          ) : (
            <p className="text-[12px] text-gray-400 leading-snug flex-1">
              Toque para saber mais sobre este material
            </p>
          )}
          <span
            className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full text-white shadow-sm group-hover:shadow-md transition-shadow"
            style={{ backgroundColor: themeColor }}
          >
            Conhecer
          </span>
        </div>

        {/* Hover glow */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            boxShadow: `0 0 20px ${themeColor}25, inset 0 0 20px ${themeColor}08`,
          }}
        />
      </button>

      {/* Dialog — chat escuro estilo WhatsApp */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl bg-white">
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
          >
            <div className="relative">
              <img src={meirePhoto} alt="Meire Rosana" className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30" />
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-400 ring-2 ring-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white drop-shadow-sm">Meire Rosana</p>
              <p className="text-[11px] text-white/70 font-medium">
                {aiLoading && visibleCount === 0 ? "digitando..." : "online"}
              </p>
            </div>
          </div>

          <div ref={scrollRef} className="px-3 py-4 space-y-2 min-h-[200px] max-h-[320px] overflow-y-auto bg-gray-50">
            {aiMessages.slice(0, visibleCount).map((msg, i) => (
              <div key={i} className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                {i === 0 ? (
                  <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" />
                ) : (
                  <div className="h-7 w-7 shrink-0" />
                )}
                <div
                  className="px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed max-w-[82%] shadow-sm text-gray-700"
                  style={{ backgroundColor: `${themeColor}10`, borderTopLeftRadius: i === 0 ? "4px" : undefined }}
                >
                  {msg}
                  <span className="block text-[10px] text-gray-400 text-right mt-1 -mb-0.5">
                    {new Date().getHours().toString().padStart(2, "0")}:{new Date().getMinutes().toString().padStart(2, "0")}
                  </span>
                </div>
              </div>
            ))}

            {showDots && (
              <div className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.2s ease-out forwards" }}>
                {visibleCount === 0 ? (
                  <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" />
                ) : (
                  <div className="h-7 w-7 shrink-0" />
                )}
                <div className="flex items-center gap-[5px] px-4 py-3 rounded-2xl rounded-tl-md shadow-sm" style={{ backgroundColor: `${themeColor}10` }}>
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="inline-block h-[6px] w-[6px] rounded-full"
                      style={{ backgroundColor: `${themeColor}70`, animation: `dotBounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {!aiLoading && !showDots && aiMessages.length === 0 && (
              <div className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.3s ease-out forwards" }}>
                <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" />
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13.5px] leading-relaxed max-w-[82%] shadow-sm text-gray-700" style={{ backgroundColor: `${themeColor}10` }}>
                  {offer.description || `${offer.name} é um material muito especial que preparamos com carinho. ❤️`}
                </div>
              </div>
            )}
          </div>

          {offer.purchase_url && ctaVisible && (
            <div className="px-4 pb-4 pt-1 bg-white" style={{ animation: "chatBubbleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
              <Button
                className="w-full h-12 rounded-xl font-bold text-white text-sm tracking-wide border-0"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`, boxShadow: `0 4px 20px ${themeColor}40` }}
                onClick={() => window.open(offer.purchase_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Quero conhecer
              </Button>
            </div>
          )}

          <style>{`
            @keyframes chatBubbleIn {
              from { opacity: 0; transform: translateY(8px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes dotBounce {
              0%, 60%, 100% { transform: translateY(0); }
              30% { transform: translateY(-4px); }
            }
          `}</style>
        </DialogContent>
      </Dialog>
    </>
  );
}
