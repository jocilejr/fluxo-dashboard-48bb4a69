import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ShoppingBag, Check, Lock } from "lucide-react";
import DailyVerse from "@/components/membros/DailyVerse";
import ProductContentViewer from "@/components/membros/ProductContentViewer";
import LockedOfferCard from "@/components/membros/LockedOfferCard";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface MemberProduct {
  id: string;
  normalized_phone: string;
  product_id: string;
  is_active: boolean;
  granted_at: string;
  delivery_products: {
    name: string;
    slug: string;
    redirect_url: string | null;
    page_logo: string | null;
    value: number | null;
  } | null;
}

interface MemberSettings {
  title: string;
  logo_url: string | null;
  welcome_message: string | null;
  theme_color: string;
  layout_order?: string[];
}

interface AiContext {
  greeting: string;
  tip: string;
  offerSuggestion: { offerId: string; message: string };
}

const AI_CACHE_KEY = "member_ai_context";
const AI_CACHE_TTL = 4 * 60 * 60 * 1000;

export default function AreaMembrosPublica() {
  const { phone } = useParams<{ phone: string }>();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MemberProduct[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [settings, setSettings] = useState<MemberSettings | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [aiContext, setAiContext] = useState<AiContext | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    if (!phone) return;
    loadMemberData();
  }, [phone]);

  const loadMemberData = async () => {
    if (!phone) return;
    setLoading(true);
    setAiLoading(true);
    const digits = phone.replace(/\D/g, "");
    const variations = generatePhoneVariations(digits);
    if (variations.length === 0) { setNotFound(true); setLoading(false); return; }

    const [productsRes, settingsRes, offersRes, customerRes] = await Promise.all([
      supabase.from("member_products").select("*, delivery_products(name, slug, redirect_url, page_logo, value)").in("normalized_phone", variations).eq("is_active", true),
      supabase.from("member_area_settings").select("*").limit(1).maybeSingle(),
      supabase.from("member_area_offers").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("customers").select("name, display_phone").in("normalized_phone", variations).limit(1).maybeSingle(),
    ]);

    if (!productsRes.data || productsRes.data.length === 0) { setNotFound(true); setLoading(false); return; }

    const memberProds = productsRes.data as unknown as MemberProduct[];
    const memberOffers = (offersRes.data || []) as any[];
    setProducts(memberProds);
    setOffers(memberOffers);
    setSettings(
      settingsRes.data
        ? (settingsRes.data as unknown as MemberSettings)
        : { title: "Área de Membros", logo_url: null, welcome_message: "Bem-vinda à sua área exclusiva! 🎉", theme_color: "#8B5CF6" }
    );
    const name = customerRes.data?.name || null;
    setCustomerName(name);
    setLoading(false);
    loadAiContext(name, memberProds, memberOffers);
  };

  const loadAiContext = async (name: string | null, prods: MemberProduct[], memberOffers: any[]) => {
    const cacheKey = `${AI_CACHE_KEY}_${phone}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < AI_CACHE_TTL) {
          setAiContext(parsed.data);
          setAiLoading(false);
          return;
        }
      }
    } catch {}

    try {
      const firstName = name?.split(" ")[0] || "Querido(a)";
      const productIds = prods.filter(p => p.delivery_products).map(p => p.product_id);
      const { data: materials } = await supabase
        .from("member_product_materials")
        .select("product_id, title")
        .in("product_id", productIds);

      const materialsByProduct: Record<string, string[]> = {};
      (materials || []).forEach(m => {
        if (!materialsByProduct[m.product_id]) materialsByProduct[m.product_id] = [];
        materialsByProduct[m.product_id].push(m.title);
      });

      const productsPayload = prods
        .filter(p => p.delivery_products)
        .map(p => ({
          name: p.delivery_products!.name,
          materials: materialsByProduct[p.product_id] || [],
        }));

      const ownedProductNames = prods
        .filter(p => p.delivery_products)
        .map(p => p.delivery_products!.name);

      const offersPayload = memberOffers.map(o => ({
        id: o.id,
        name: o.name,
        description: o.description,
        categoryTag: o.category_tag,
      }));

      const { data, error } = await supabase.functions.invoke("member-ai-context", {
        body: { firstName, products: productsPayload, offers: offersPayload, ownedProductNames },
      });

      if (!error && data?.greeting) {
        const ctx: AiContext = {
          greeting: data.greeting,
          tip: data.tip || "",
          offerSuggestion: data.offerSuggestion || { offerId: "", message: "" },
        };
        setAiContext(ctx);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data: ctx, cachedAt: Date.now() }));
        } catch {}
      }
    } catch {}
    setAiLoading(false);
  };

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime());
  }, [products]);

  const ownedProductNames = useMemo(() => {
    return products.filter(p => p.delivery_products).map(p => p.delivery_products!.name);
  }, [products]);

  const firstName = customerName?.split(" ")[0] || "Querido(a)";

  // Find the product being viewed in popup
  const openProduct = useMemo(() => {
    if (!openProductId) return null;
    return sortedProducts.find(p => p.id === openProductId) || null;
  }, [openProductId, sortedProducts]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Crown className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Área não encontrada</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Não encontramos produtos liberados para este número.</p>
        </div>
      </div>
    );
  }

  const themeColor = settings?.theme_color || "#8B5CF6";
  const greetingText = aiContext?.greeting || settings?.welcome_message || "Sua área exclusiva";

  const isRecent = (grantedAt: string) => {
    const diffDays = (Date.now() - new Date(grantedAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  const renderProductCard = (mp: MemberProduct, index: number) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const recent = isRecent(mp.granted_at);

    return (
      <button
        key={mp.id}
        className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 text-left active:scale-[0.98]"
        onClick={() => setOpenProductId(mp.id)}
      >
        {product.page_logo ? (
          <div className="relative shrink-0">
            <img
              src={product.page_logo}
              alt={product.name}
              className="h-16 w-16 rounded-xl object-cover"
              style={{ border: `2px solid ${themeColor}20` }}
            />
            <div
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm"
              style={{ backgroundColor: "#10b981" }}
            >
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </div>
          </div>
        ) : (
          <div
            className="h-16 w-16 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}08)` }}
          >
            <ShoppingBag className="h-7 w-7" style={{ color: themeColor }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-[15px] leading-tight truncate">{product.name}</h3>
          {recent ? (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              ✓ Liberado recentemente
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-gray-500">
              ✓ Liberado
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Theme accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}90, ${themeColor})` }} />

      {/* Header — Clean & light */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-5 flex items-center gap-4">
          {settings?.logo_url && (
            <img
              src={settings.logo_url}
              alt="Logo"
              className="h-14 w-14 rounded-2xl object-cover shrink-0 shadow-sm"
              style={{ border: `2px solid ${themeColor}20` }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">
              Olá, {firstName}
            </h1>
            <p
              className="text-sm text-gray-500 mt-0.5 leading-relaxed line-clamp-2 transition-opacity duration-700"
              style={{ opacity: aiContext?.greeting ? 1 : 0.7 }}
            >
              {greetingText}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-5 pb-20 space-y-3">
        {/* Products as horizontal cards */}
        {sortedProducts.length > 0 && renderProductCard(sortedProducts[0], 0)}

        {/* AI suggested offer — between first product and rest */}
        {aiContext?.offerSuggestion?.offerId && aiContext.offerSuggestion.message ? (
          (() => {
            const suggestedOffer = offers.find((o: any) => o.id === aiContext.offerSuggestion.offerId);
            return suggestedOffer ? (
              <LockedOfferCard
                offer={suggestedOffer}
                themeColor={themeColor}
                aiMessage={aiContext.offerSuggestion.message}
                ownedProductNames={ownedProductNames}
              />
            ) : null;
          })()
        ) : null}

        {/* AI tip — subtle inline */}
        {aiContext?.tip && (
          <p className="text-sm text-gray-500 italic leading-relaxed px-1 transition-opacity duration-700">
            {aiContext.tip}
          </p>
        )}

        {/* Remaining products */}
        {sortedProducts.slice(1).map((mp, i) => renderProductCard(mp, i + 1))}

        {/* Daily Verse */}
        <DailyVerse />

        {/* Remaining offers */}
        {(() => {
          const filteredOffers = aiContext?.offerSuggestion?.offerId
            ? offers.filter((o: any) => o.id !== aiContext.offerSuggestion.offerId)
            : offers;
          return filteredOffers.length > 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                Descubra mais
              </p>
              {filteredOffers.map((offer: any) => (
                <LockedOfferCard
                  key={offer.id}
                  offer={offer}
                  themeColor={themeColor}
                  ownedProductNames={ownedProductNames}
                />
              ))}
            </div>
          ) : null;
        })()}
      </main>

      {/* Product content popup */}
      <Dialog open={!!openProductId} onOpenChange={(open) => !open && setOpenProductId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
          {openProduct?.delivery_products && (
            <>
              <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3">
                {openProduct.delivery_products.page_logo && (
                  <img
                    src={openProduct.delivery_products.page_logo}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                )}
                <h2 className="font-bold text-gray-800 text-lg truncate">{openProduct.delivery_products.name}</h2>
              </div>
              <div className="p-5">
                <ProductContentViewer
                  productId={openProduct.product_id}
                  productName={openProduct.delivery_products.name}
                  themeColor={themeColor}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <footer className="text-center py-6 border-t border-gray-100 bg-white">
        <p className="text-[11px] text-gray-400">Área exclusiva para membros ✝️</p>
      </footer>
    </div>
  );
}
