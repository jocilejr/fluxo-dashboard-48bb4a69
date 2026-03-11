import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ShoppingBag, ChevronDown, Sparkles, ShieldCheck } from "lucide-react";
import DailyVerse from "@/components/membros/DailyVerse";
import ProductContentViewer from "@/components/membros/ProductContentViewer";
import LockedOfferCard from "@/components/membros/LockedOfferCard";

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

function AiLoadingSkeleton({ themeColor }: { themeColor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm px-4 py-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${themeColor}15` }}>
          <Sparkles className="h-4 w-4 animate-pulse" style={{ color: themeColor }} />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="h-3 rounded-full bg-slate-200 w-3/4" />
          <div className="h-3 rounded-full bg-slate-100 w-1/2" />
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="inline-flex gap-[3px]">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
        Preparando sugestões personalizadas...
      </div>
    </div>
  );
}

export default function AreaMembrosPublica() {
  const { phone } = useParams<{ phone: string }>();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MemberProduct[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [settings, setSettings] = useState<MemberSettings | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
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

    const sorted = [...memberProds].sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime());
    if (sorted.length > 0) setExpandedProduct(sorted[0].id);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400 mx-auto" />
          <p className="text-slate-400 text-sm">Preparando sua área...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Crown className="h-8 w-8 text-slate-300" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Área não encontrada</h1>
          <p className="text-slate-500 text-sm leading-relaxed">Não encontramos produtos liberados para este número.</p>
        </div>
      </div>
    );
  }

  const themeColor = settings?.theme_color || "#8B5CF6";

  const renderProductCard = (mp: MemberProduct) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const isExpanded = expandedProduct === mp.id;
    return (
      <div
        key={mp.id}
        className="rounded-2xl bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
        style={{ borderLeft: `4px solid ${themeColor}` }}
      >
        <button
          className="w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors hover:bg-slate-50/50"
          onClick={() => setExpandedProduct(isExpanded ? null : mp.id)}
        >
          {product.page_logo ? (
            <img src={product.page_logo} alt={product.name} className="h-12 w-12 rounded-xl object-cover shrink-0 shadow-sm" />
          ) : (
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}>
              <ShoppingBag className="h-5 w-5" style={{ color: themeColor }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm truncate">{product.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Liberado</span>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-100">
            <div className="pt-4">
              <ProductContentViewer productId={mp.product_id} productName={product.name} themeColor={themeColor} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Theme color bar */}
      <div className="h-1" style={{ backgroundColor: themeColor }} />

      {/* Header — clean and compact */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-5 py-5 flex items-center gap-4">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="h-12 w-12 rounded-xl object-cover shadow-sm shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900">
              Olá, {firstName}! 👋
            </p>
            <p className="text-sm text-slate-500 truncate">
              {settings?.welcome_message || "Sua área exclusiva"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 pt-6 pb-16 space-y-5">
        {/* AI Greeting */}
        {aiLoading && !aiContext ? (
          <AiLoadingSkeleton themeColor={themeColor} />
        ) : aiContext?.greeting ? (
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200/60 px-4 py-3.5 bg-white/80 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${themeColor}15` }}>
              <Sparkles className="h-4 w-4" style={{ color: themeColor }} />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed pt-1">{aiContext.greeting}</p>
          </div>
        ) : null}

        {/* Products section */}
        {sortedProducts.length > 0 && (
          <section>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                <Crown className="h-3.5 w-3.5" style={{ color: themeColor }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Seus Conteúdos</h2>
                <p className="text-[11px] text-slate-400">{products.length} {products.length === 1 ? 'produto liberado' : 'produtos liberados'}</p>
              </div>
            </div>
            <div className="space-y-3">
              {/* First product */}
              {renderProductCard(sortedProducts[0])}

              {/* AI suggested offer between products — looks like a product but locked */}
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
              ) : aiLoading ? (
                <AiLoadingSkeleton themeColor={themeColor} />
              ) : null}

              {/* Remaining products */}
              {sortedProducts.slice(1).map((mp) => renderProductCard(mp))}
            </div>
          </section>
        )}

        {/* AI personal message — conversational, not a "tip" */}
        {aiContext?.tip && (
          <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm px-4 py-3.5">
            <p className="text-sm text-slate-600 leading-relaxed">{aiContext.tip}</p>
          </div>
        )}

        {/* Daily Verse */}
        <DailyVerse />

        {/* Remaining offers — same locked product style */}
        {(() => {
          const filteredOffers = aiContext?.offerSuggestion?.offerId
            ? offers.filter((o: any) => o.id !== aiContext.offerSuggestion.offerId)
            : offers;
          return filteredOffers.length > 0 ? (
            <section>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <span className="text-sm">🔒</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Conteúdos Exclusivos</h2>
                  <p className="text-[11px] text-slate-400">Descubra mais conteúdos para sua jornada</p>
                </div>
              </div>
              <div className="space-y-3">
                {filteredOffers.map((offer: any) => (
                  <LockedOfferCard
                    key={offer.id}
                    offer={offer}
                    themeColor={themeColor}
                    ownedProductNames={ownedProductNames}
                  />
                ))}
              </div>
            </section>
          ) : null;
        })()}
      </main>

      <footer className="text-center py-6 border-t border-slate-100 bg-white">
        <p className="text-[11px] text-slate-400">Área exclusiva para membros ✝️</p>
      </footer>
    </div>
  );
}
