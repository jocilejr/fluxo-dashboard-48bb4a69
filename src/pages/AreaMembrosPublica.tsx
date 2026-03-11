import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ShoppingBag, ChevronDown, Sparkles, Lightbulb, ShieldCheck } from "lucide-react";
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
    <div className="rounded-xl border border-slate-200/60 bg-white/60 backdrop-blur-sm px-4 py-4 space-y-4 animate-pulse">
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

      const offersPayload = memberOffers.map(o => ({
        id: o.id,
        name: o.name,
        description: o.description,
        categoryTag: o.category_tag,
      }));

      const { data, error } = await supabase.functions.invoke("member-ai-context", {
        body: { firstName, products: productsPayload, offers: offersPayload },
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

  const firstName = customerName?.split(" ")[0] || "Querido(a)";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">
        <div className="text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-400/60 mx-auto" />
          <p className="text-slate-400 text-sm">Preparando sua área...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 p-4">
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
  const defaultLayout = ["greeting", "products_interleaved", "ai_tip", "verse", "offers"];

  const renderProductCard = (mp: MemberProduct) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const isExpanded = expandedProduct === mp.id;
    return (
      <div key={mp.id} className="rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
        style={{ borderLeft: `4px solid ${themeColor}` }}>
        <button
          className="w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors hover:bg-slate-50/50"
          onClick={() => setExpandedProduct(isExpanded ? null : mp.id)}
        >
          {product.page_logo ? (
            <img src={product.page_logo} alt={product.name} className="h-11 w-11 rounded-xl object-cover shrink-0 shadow-sm" />
          ) : (
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}>
              <ShoppingBag className="h-4.5 w-4.5" style={{ color: themeColor }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm truncate">{product.name}</h3>
            <div className="flex items-center gap-1 mt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600">Adquirido</span>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/10">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${themeColor}, ${themeColor}dd, ${themeColor}99)` }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`, backgroundSize: '40px 40px, 60px 60px' }} />
        
        <div className="relative max-w-3xl mx-auto px-5 py-8 sm:py-10 text-center text-white">
          {settings?.logo_url && (
            <div className="mb-4">
              <img src={settings.logo_url} alt="Logo" className="h-14 w-14 rounded-xl mx-auto shadow-xl border-2 border-white/20 object-cover" />
            </div>
          )}
          <p className="text-lg sm:text-xl font-bold tracking-tight leading-relaxed max-w-md mx-auto">
            Olá, <span className="font-extrabold">{firstName}</span>! {settings?.welcome_message}
          </p>
        </div>
        
        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 50V15C360 0 720 0 1080 15C1260 25 1380 38 1440 50H0Z" fill="url(#bg-grad)" />
            <defs>
              <linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f8fafc" />
                <stop offset="1" stopColor="white" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 pt-4 pb-16 space-y-5">
        {(() => {
          const rawLayout = settings?.layout_order || defaultLayout;
          // Auto-migrate old layout names to unified products_interleaved
          const hasOldSections = rawLayout.includes("recent_product") || rawLayout.includes("other_products") || rawLayout.includes("content");
          const effectiveLayout = hasOldSections
            ? ["greeting", "products_interleaved", "ai_tip", "verse", "offers"]
            : rawLayout;
          // Deduplicate
          const seen = new Set<string>();
          return effectiveLayout.filter((s: string) => { if (seen.has(s)) return false; seen.add(s); return true; });
        })().map((section: string) => {
          switch (section) {
            case "greeting":
              if (aiLoading && !aiContext) {
                return <AiLoadingSkeleton key="greeting-loading" themeColor={themeColor} />;
              }
              return aiContext?.greeting ? (
                <div key="greeting" className="flex items-start gap-3 rounded-xl shadow-sm border border-slate-200/60 px-4 py-3.5 overflow-hidden relative bg-white/70 backdrop-blur-sm">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}>
                    <Sparkles className="h-4 w-4" style={{ color: themeColor }} />
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed pt-1">{aiContext.greeting}</p>
                </div>
              ) : null;

            case "products_interleaved": {
              if (sortedProducts.length === 0) return null;
              const suggestedOffer = aiContext?.offerSuggestion?.offerId
                ? offers.find((o: any) => o.id === aiContext.offerSuggestion.offerId)
                : null;

              return (
                <section key="products_interleaved">
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

                    {/* AI suggestion between products */}
                    {suggestedOffer && aiContext?.offerSuggestion?.message && (
                      <LockedOfferCard
                        offer={suggestedOffer}
                        themeColor={themeColor}
                        aiMessage={aiContext.offerSuggestion.message}
                        isHighlighted
                        inline
                      />
                    )}
                    {!suggestedOffer && aiLoading && (
                      <AiLoadingSkeleton themeColor={themeColor} />
                    )}

                    {/* Remaining products */}
                    {sortedProducts.slice(1).map((mp) => renderProductCard(mp))}
                  </div>
                </section>
              );
            }

            // Keep backward compat for saved layouts
            case "recent_product":
              return sortedProducts.length > 0 ? (
                <section key="recent_product">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                      <Crown className="h-3.5 w-3.5" style={{ color: themeColor }} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Produto Recente</h2>
                      <p className="text-[11px] text-slate-400">Seu conteúdo mais recente</p>
                    </div>
                  </div>
                  {renderProductCard(sortedProducts[0])}
                </section>
              ) : null;

            case "ai_tip":
              if (aiLoading && !aiContext?.tip) return null;
              return aiContext?.tip ? (
                <div key="ai_tip" className="flex items-start gap-3 rounded-xl px-4 py-3 border border-amber-200/60"
                  style={{ background: `linear-gradient(135deg, #fffbeb, #fef3c7, #fffbeb)` }}>
                  <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Dica para você</p>
                    <p className="text-sm text-amber-900 leading-relaxed">{aiContext.tip}</p>
                  </div>
                </div>
              ) : null;

            case "other_products":
              return sortedProducts.length > 1 ? (
                <section key="other_products">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                      <ShoppingBag className="h-3.5 w-3.5" style={{ color: themeColor }} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Demais Produtos</h2>
                      <p className="text-[11px] text-slate-400">{sortedProducts.length - 1} {sortedProducts.length - 1 === 1 ? 'produto' : 'produtos'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {sortedProducts.slice(1).map((mp) => renderProductCard(mp))}
                  </div>
                </section>
              ) : null;

            case "verse":
              return <DailyVerse key="verse" />;

            case "ai_offer": {
              if (!aiContext?.offerSuggestion?.offerId || !aiContext.offerSuggestion.message) return null;
              const suggested = offers.find((o: any) => o.id === aiContext.offerSuggestion.offerId);
              if (!suggested) return null;
              return (
                <section key="ai_offer">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}>
                      <Sparkles className="h-3.5 w-3.5" style={{ color: themeColor }} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Sugestão para você</h2>
                      <p className="text-[11px] text-slate-400">Baseado no seu perfil</p>
                    </div>
                  </div>
                  <LockedOfferCard
                    offer={suggested}
                    themeColor={themeColor}
                    aiMessage={aiContext.offerSuggestion.message}
                    isHighlighted
                  />
                </section>
              );
            }

            case "offers": {
              const filteredOffers = aiContext?.offerSuggestion?.offerId
                ? offers.filter((o: any) => o.id !== aiContext.offerSuggestion.offerId)
                : offers;
              return filteredOffers.length > 0 ? (
                <section key="offers">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
                      <span className="text-sm">🔒</span>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Conteúdos Exclusivos</h2>
                      <p className="text-[11px] text-slate-400">Descubra mais conteúdos para sua jornada</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredOffers.map((offer: any) => (
                      <LockedOfferCard key={offer.id} offer={offer} themeColor={themeColor} />
                    ))}
                  </div>
                </section>
              ) : null;
            }

            case "content":
              return sortedProducts.length > 0 ? (
                <section key="content">
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
                    {sortedProducts.map((mp) => renderProductCard(mp))}
                  </div>
                </section>
              ) : null;

            default:
              return null;
          }
        })}
      </main>

      <footer className="text-center py-6 border-t border-slate-100">
        <p className="text-[11px] text-slate-400">Área exclusiva para membros ✝️</p>
      </footer>
    </div>
  );
}
