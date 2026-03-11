import { ExternalLink, Sparkles, Gift } from "lucide-react";
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

export default function BottomPageOffer({ offer, themeColor }: Props) {
  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-lg border"
      style={{ borderColor: `${themeColor}20` }}
    >
      {/* Background image or gradient */}
      {offer.image_url ? (
        <div className="relative">
          <img
            src={offer.image_url}
            alt={offer.name}
            className="w-full h-48 object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${themeColor}ee 0%, ${themeColor}99 40%, transparent 100%)`,
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            {offer.category_tag && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold mb-2 bg-white/20 backdrop-blur-sm"
              >
                <Sparkles className="h-3 w-3" />
                {offer.category_tag}
              </span>
            )}
            <h3 className="font-extrabold text-xl leading-tight drop-shadow-md">
              {offer.name}
            </h3>
          </div>
        </div>
      ) : (
        <div
          className="relative p-6 pb-4"
          style={{
            background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}08 50%, ${themeColor}12 100%)`,
          }}
        >
          <Gift
            className="absolute top-4 right-4 h-12 w-12 opacity-10"
            style={{ color: themeColor }}
          />
          {offer.category_tag && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white mb-3"
              style={{ backgroundColor: themeColor }}
            >
              <Sparkles className="h-3 w-3" />
              {offer.category_tag}
            </span>
          )}
          <h3 className="font-extrabold text-gray-800 text-xl leading-tight">
            {offer.name}
          </h3>
        </div>
      )}

      {/* Content section */}
      <div className="p-5 bg-white space-y-4">
        {offer.description && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {offer.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          {offer.price && (
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Por apenas</p>
              <p className="text-xl font-extrabold" style={{ color: themeColor }}>
                R$ {Number(offer.price).toFixed(2).replace(".", ",")}
              </p>
            </div>
          )}
          {offer.purchase_url && (
            <Button
              className="h-12 px-6 rounded-xl font-bold text-white text-sm border-0 shadow-md hover:shadow-lg transition-all"
              style={{
                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                boxShadow: `0 4px 20px ${themeColor}35`,
              }}
              onClick={() => window.open(offer.purchase_url, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Quero conhecer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
