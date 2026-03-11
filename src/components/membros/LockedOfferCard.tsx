import { Lock, ShoppingBag } from "lucide-react";
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
}

export default function LockedOfferCard({ offer, themeColor }: Props) {
  return (
    <Card className="overflow-hidden border-gray-100 hover:shadow-xl transition-all duration-500 group relative rounded-2xl">
      {/* Locked overlay badge */}
      <div className="absolute top-3 right-3 z-10">
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
          <Lock className="h-3 w-3" /> Bloqueado
        </div>
      </div>

      {offer.image_url && (
        <div className="aspect-[16/10] overflow-hidden relative">
          <img
            src={offer.image_url}
            alt={offer.name}
            className="w-full h-full object-cover filter blur-[3px] group-hover:blur-[1px] transition-all duration-700 scale-110 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>
      )}

      <CardContent className="p-5 space-y-3">
        {offer.category_tag && (
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${themeColor}12`, color: themeColor }}
          >
            {offer.category_tag}
          </span>
        )}
        <h3 className="font-bold text-gray-900 text-base leading-snug">{offer.name}</h3>
        {offer.description && (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{offer.description}</p>
        )}
        {offer.price && (
          <p className="text-xl font-extrabold" style={{ color: themeColor }}>
            R$ {offer.price.toFixed(2).replace(".", ",")}
          </p>
        )}
        <Button
          className="w-full text-white font-semibold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] rounded-xl h-11"
          style={{ 
            background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
          }}
          onClick={() => window.open(offer.purchase_url, "_blank")}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Quero adquirir
        </Button>
      </CardContent>
    </Card>
  );
}
