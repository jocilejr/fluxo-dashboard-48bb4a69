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
    <Card className={`overflow-hidden transition-all duration-500 group relative rounded-xl ${isHighlighted ? 'border-2 shadow-lg ring-1 ring-offset-1' : 'border-slate-200/80 hover:shadow-lg'}`}
      style={isHighlighted ? { borderColor: themeColor, boxShadow: `0 0 0 2px ${themeColor}20` } : undefined}
    >
      {isHighlighted && (
        <div className="absolute top-3 left-3 z-10">
          <div className="flex items-center gap-1 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg"
            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
            <Sparkles className="h-3 w-3" /> Recomendado para você
          </div>
        </div>
      )}

      {!isHighlighted && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1.5 bg-slate-800/70 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
            <Lock className="h-3 w-3" /> Bloqueado
          </div>
        </div>
      )}

      {offer.image_url && (
        <div className="aspect-[16/10] overflow-hidden relative">
          <img
            src={offer.image_url}
            alt={offer.name}
            className={`w-full h-full object-cover transition-all duration-700 scale-110 group-hover:scale-105 ${isHighlighted ? '' : 'filter blur-[3px] group-hover:blur-[1px]'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
        </div>
      )}

      <CardContent className="p-4 space-y-2.5">
        {offer.category_tag && (
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
          >
            {offer.category_tag}
          </span>
        )}
        <h3 className="font-bold text-slate-900 text-sm leading-snug">{offer.name}</h3>
        
        {aiMessage && (
          <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 pl-2.5 py-0.5" style={{ borderColor: `${themeColor}60` }}>
            {aiMessage}
          </p>
        )}
        
        {!aiMessage && offer.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{offer.description}</p>
        )}
        {offer.price && (
          <p className="text-lg font-extrabold" style={{ color: themeColor }}>
            R$ {offer.price.toFixed(2).replace(".", ",")}
          </p>
        )}
        <Button
          className="w-full text-white font-semibold shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02] rounded-lg h-10 text-sm"
          style={{ 
            background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
          }}
          onClick={() => offer.purchase_url && window.open(offer.purchase_url, "_blank")}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Quero adquirir
        </Button>
      </CardContent>
    </Card>
  );
}
