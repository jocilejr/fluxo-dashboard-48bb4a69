import { Lock, ShoppingBag, Sparkles } from "lucide-react";
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
      <div className="relative rounded-xl overflow-hidden border border-slate-200/80 shadow-sm transition-all duration-500 group"
        style={{ background: `linear-gradient(135deg, ${themeColor}06, white, ${themeColor}04)` }}>
        
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${themeColor}60, ${themeColor}20, transparent)` }} />
        
        <div className="flex items-start gap-3.5 p-4">
          <div className="relative shrink-0">
            {offer.image_url ? (
              <img src={offer.image_url} alt={offer.name} className="h-14 w-14 rounded-xl object-cover shadow-sm filter brightness-90" />
            ) : (
              <div className="h-14 w-14 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}05)` }}>
                <ShoppingBag className="h-5 w-5" style={{ color: themeColor }} />
              </div>
            )}
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-slate-700 flex items-center justify-center shadow-md">
              <Lock className="h-2.5 w-2.5 text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm truncate">{offer.name}</h3>
              {offer.category_tag && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                  {offer.category_tag}
                </span>
              )}
            </div>

            {aiMessage && (
              <div className="flex items-start gap-2">
                <Sparkles className="h-3 w-3 shrink-0 mt-0.5" style={{ color: themeColor }} />
                <p className="text-xs text-slate-600 leading-relaxed italic">{aiMessage}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              {offer.price && (
                <p className="text-base font-extrabold" style={{ color: themeColor }}>
                  R$ {offer.price.toFixed(2).replace(".", ",")}
                </p>
              )}
              <Button
                size="sm"
                className="text-white text-xs font-semibold rounded-lg h-8 px-4 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                onClick={() => offer.purchase_url && window.open(offer.purchase_url, "_blank")}
              >
                <Lock className="h-3 w-3 mr-1.5" />
                Desbloquear
              </Button>
            </div>
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
