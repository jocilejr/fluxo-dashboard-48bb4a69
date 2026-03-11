import { Sparkles, ArrowRight } from "lucide-react";

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

export default function PhysicalProductShowcase({ offer, themeColor }: Props) {
  return (
    <div className="space-y-1">
      {/* GIF / Image */}
      {offer.image_url && (
        <div className="relative overflow-hidden rounded-2xl shadow-lg">
          <div className="aspect-video">
            <img
              src={offer.image_url}
              alt={offer.name}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Subtle gradient overlay at bottom */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background: `linear-gradient(to top, ${themeColor}22, transparent)`,
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="text-center space-y-3 py-4 px-2">
        <h3 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5" style={{ color: themeColor }} />
          {offer.name}
        </h3>

        {offer.description && (
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            {offer.description}
          </p>
        )}

        {offer.price != null && offer.price > 0 && (
          <p className="text-lg font-semibold text-gray-700">
            R$ {Number(offer.price).toFixed(2).replace(".", ",")}
          </p>
        )}

        {offer.purchase_url && (
          <button
            onClick={() => window.open(offer.purchase_url, "_blank")}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-white font-semibold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 animate-pulse-soft"
            style={{
              background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
            }}
          >
            Reservar o seu
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
