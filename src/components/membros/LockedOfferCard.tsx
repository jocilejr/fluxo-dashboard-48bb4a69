import { Lock, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <Card className="overflow-hidden border-gray-200 hover:shadow-lg transition-all duration-300 group relative">
      {/* Locked badge */}
      <div className="absolute top-3 right-3 z-10">
        <Badge className="bg-gray-800/80 text-white backdrop-blur-sm gap-1">
          <Lock className="h-3 w-3" /> Bloqueado
        </Badge>
      </div>

      {offer.image_url && (
        <div className="aspect-video overflow-hidden relative">
          <img
            src={offer.image_url}
            alt={offer.name}
            className="w-full h-full object-cover filter blur-[2px] group-hover:blur-[1px] transition-all duration-500 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <CardContent className="p-5 space-y-3">
        {offer.category_tag && (
          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
            {offer.category_tag}
          </Badge>
        )}
        <h3 className="font-semibold text-gray-800">{offer.name}</h3>
        {offer.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{offer.description}</p>
        )}
        {offer.price && (
          <p className="text-lg font-bold" style={{ color: themeColor }}>
            R$ {offer.price.toFixed(2).replace(".", ",")}
          </p>
        )}
        <Button
          className="w-full text-white shadow-md"
          style={{ backgroundColor: themeColor }}
          onClick={() => window.open(offer.purchase_url, "_blank")}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Quero adquirir
        </Button>
      </CardContent>
    </Card>
  );
}
