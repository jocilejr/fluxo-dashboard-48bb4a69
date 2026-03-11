import { Lock, ShoppingBag, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  isHighlighted?: boolean;
  inline?: boolean;
}

export default function LockedOfferCard({ offer, themeColor, aiMessage, isHighlighted, inline }: Props) {
  if (inline) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-slate-200/60 px-3 py-2.5 transition-all duration-300 cursor-pointer hover:shadow-sm"
        style={{ background: `linear-gradient(135deg, ${themeColor}04, white, ${themeColor}03)` }}
        onClick={() => offer.purchase_url && window.open(offer.purchase_url, "_blank")}
      >
        {/* Image */}
        <div className="relative shrink-0">
          {offer.image_url ? (
            <img src={offer.image_url} alt={offer.name} className="h-14 w-16 rounded-lg object-cover" />
          ) : (
            <div className="h-14 w-16 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}12, ${themeColor}06)` }}>
              <ShoppingBag className="h-4 w-4" style={{ color: themeColor }} />
            </div>
          )}
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-slate-600 flex items-center justify-center">
            <Lock className="h-2 w-2 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {aiMessage ? (
            <p className="text-xs text-slate-600 leading-snug line-clamp-2">{aiMessage}</p>
          ) : (
            <p className="text-xs text-slate-600 leading-snug line-clamp-2">{offer.description || offer.name}</p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[11px] font-semibold" style={{ color: themeColor }}>Conhecer</span>
            <ArrowRight className="h-3 w-3" style={{ color: themeColor }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-all duration-300 cursor-pointer hover:shadow-md ${isHighlighted ? 'border-2' : 'border-slate-200/60 hover:border-slate-300'}`}
      style={{
        background: isHighlighted
          ? `linear-gradient(135deg, ${themeColor}06, white, ${themeColor}04)`
          : `linear-gradient(135deg, ${themeColor}03, white)`,
        ...(isHighlighted ? { borderColor: `${themeColor}40` } : {}),
      }}
      onClick={() => offer.purchase_url && window.open(offer.purchase_url, "_blank")}
    >
      {/* Image */}
      <div className="relative shrink-0">
        {offer.image_url ? (
          <img src={offer.image_url} alt={offer.name} className="h-20 w-24 rounded-xl object-cover" />
        ) : (
          <div
            className="h-20 w-24 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}08)` }}
          >
            <ShoppingBag className="h-6 w-6" style={{ color: themeColor }} />
          </div>
        )}
        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-700 flex items-center justify-center shadow-sm">
          <Lock className="h-2.5 w-2.5 text-white" />
        </div>
        {isHighlighted && (
          <div
            className="absolute -top-2 -left-2 flex items-center gap-0.5 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow"
            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
          >
            <Sparkles className="h-2.5 w-2.5" /> Recomendado
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {offer.category_tag && (
          <span
            className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
          >
            {offer.category_tag}
          </span>
        )}
        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{offer.name}</h3>
        {aiMessage ? (
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{aiMessage}</p>
        ) : offer.description ? (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{offer.description}</p>
        ) : null}
        <div className="flex items-center gap-1 pt-0.5">
          <span className="text-[11px] font-semibold" style={{ color: themeColor }}>Conhecer</span>
          <ArrowRight className="h-3 w-3" style={{ color: themeColor }} />
        </div>
      </div>
    </div>
  );
}
