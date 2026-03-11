import { useState, useRef, useEffect, useCallback } from "react";
import { Lock, ExternalLink } from "lucide-react";
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
  const [showDots, setShowDots] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const pitchCache = useRef<Record<string, string[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount, showDots]);

  // Reveal messages one by one with dots in between
  useEffect(() => {
    if (aiMessages.length === 0 || visibleCount >= aiMessages.length) return;

    // Show dots briefly, then reveal message
    setShowDots(true);
    const dotsTimer = setTimeout(() => {
      setShowDots(false);
      setVisibleCount(prev => prev + 1);
    }, visibleCount === 0 ? 400 : 900);

    return () => clearTimeout(dotsTimer);
  }, [aiMessages, visibleCount]);

  // Show CTA after all messages
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

  return (
    <>
      {/* Card externo — minimalista */}
      <button
        className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all duration-300 text-left active:scale-[0.98]"
        style={{ borderColor: `${themeColor}15` }}
        onClick={handleOpen}
      >
        <div className="relative shrink-0">
          {offer.image_url ? (
            <img
              src={offer.image_url}
              alt={offer.name}
              className="h-16 w-16 rounded-xl object-cover opacity-80 grayscale-[20%]"
              style={{ border: `2px solid ${themeColor}20` }}
            />
          ) : (
            <div
              className="h-16 w-16 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${themeColor}12, ${themeColor}06)` }}
            >
              <Lock className="h-6 w-6" style={{ color: `${themeColor}80` }} />
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
          <h3 className="font-extrabold text-gray-800 text-[15px] leading-tight truncate">{offer.name}</h3>
          <span
            className="flex items-center gap-1.5 mt-1.5 text-[12px] font-semibold"
            style={{ color: themeColor }}
          >
            🔒 Toque para saber mais
          </span>
        </div>
      </button>

      {/* Dialog — chat escuro estilo WhatsApp */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl bg-[#0b141a]">
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
          >
            <div className="relative">
              <img
                src={meirePhoto}
                alt="Meire Rosana"
                className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30"
              />
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-400 ring-2 ring-[#0b141a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white drop-shadow-sm">Meire Rosana</p>
              <p className="text-[11px] text-white/70 font-medium">
                {aiLoading && visibleCount === 0 ? "digitando..." : "online"}
              </p>
            </div>
            {offer.image_url && (
              <img
                src={offer.image_url}
                alt={offer.name}
                className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/20"
              />
            )}
          </div>

          {/* Chat body */}
          <div
            ref={scrollRef}
            className="px-3 py-4 space-y-2 min-h-[200px] max-h-[320px] overflow-y-auto"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {/* Messages */}
            {aiMessages.slice(0, visibleCount).map((msg, i) => (
              <div
                key={i}
                className="flex items-end gap-2"
                style={{
                  animation: "chatBubbleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                {i === 0 ? (
                  <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" />
                ) : (
                  <div className="h-7 w-7 shrink-0" />
                )}
                <div
                  className="px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed max-w-[82%] shadow-sm"
                  style={{
                    backgroundColor: `${themeColor}18`,
                    color: "#e9edef",
                    borderTopLeftRadius: i === 0 ? "4px" : undefined,
                  }}
                >
                  {msg}
                  <span className="block text-[10px] text-white/30 text-right mt-1 -mb-0.5">
                    {new Date().getHours().toString().padStart(2, "0")}:{new Date().getMinutes().toString().padStart(2, "0")}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing dots */}
            {showDots && (
              <div className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.2s ease-out forwards" }}>
                {visibleCount === 0 ? (
                  <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" />
                ) : (
                  <div className="h-7 w-7 shrink-0" />
                )}
                <div
                  className="flex items-center gap-[5px] px-4 py-3 rounded-2xl rounded-tl-md shadow-sm"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="inline-block h-[6px] w-[6px] rounded-full"
                      style={{
                        backgroundColor: `${themeColor}90`,
                        animation: `dotBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Fallback if no AI messages */}
            {!aiLoading && !showDots && aiMessages.length === 0 && (
              <div className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.3s ease-out forwards" }}>
                <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" />
                <div
                  className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13.5px] leading-relaxed max-w-[82%] shadow-sm"
                  style={{ backgroundColor: `${themeColor}18`, color: "#e9edef" }}
                >
                  {offer.description || `${offer.name} é um material muito especial que preparamos com carinho. ❤️`}
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          {offer.purchase_url && ctaVisible && (
            <div
              className="px-4 pb-4 pt-1"
              style={{ animation: "chatBubbleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards", backgroundColor: "#0b141a" }}
            >
              <Button
                className="w-full h-12 rounded-xl font-bold text-white text-sm tracking-wide border-0"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                  boxShadow: `0 4px 20px ${themeColor}40`,
                }}
                onClick={() => window.open(offer.purchase_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Quero conhecer
              </Button>
            </div>
          )}

          {/* Inline keyframes */}
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
