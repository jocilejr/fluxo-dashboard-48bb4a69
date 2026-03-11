import { ArrowRight } from "lucide-react";

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
    <section className="py-8 px-4">
      {/* Subtle divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-[11px] uppercase tracking-widest text-gray-400 font-medium">
          {offer.category_tag || "exclusivo"}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Small product image */}
        {offer.image_url && (
          <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-sm">
            <img
              src={offer.image_url}
              alt={offer.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Minimal copy */}
        <div className="text-center space-y-1.5 max-w-xs">
          <p className="text-sm font-semibold text-gray-700">
            {offer.name}
          </p>
          {offer.description && (
            <p className="text-xs text-gray-400 leading-relaxed">
              {offer.description}
            </p>
          )}
        </div>

        {/* Subtle CTA */}
        {offer.purchase_url && (
          <button
            onClick={() => window.open(offer.purchase_url, "_blank")}
            className="inline-flex items-center gap-1.5 text-xs font-medium py-2 px-5 rounded-full border transition-all duration-200 hover:scale-[1.03]"
            style={{
              color: themeColor,
              borderColor: `${themeColor}40`,
              backgroundColor: `${themeColor}08`,
            }}
          >
            Reservar o seu
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </section>
  );
}
