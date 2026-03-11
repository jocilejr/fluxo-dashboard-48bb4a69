import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ShoppingBag, ChevronDown, ShieldCheck, Check } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-slate-500 mx-auto" />
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <Crown className="h-8 w-8 text-slate-600" />
          </div>
          <h1 className="text-xl font-bold text-white">Área não encontrada</h1>
          <p className="text-slate-400 text-sm leading-relaxed">Não encontramos produtos liberados para este número.</p>
        </div>
      </div>
    );
  }

  const themeColor = settings?.theme_color || "#8B5CF6";

  const renderHeroProduct = (mp: MemberProduct) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const isExpanded = expandedProduct === mp.id;

    return (
      <div
        key={mp.id}
        className="rounded-3xl overflow-hidden transition-all duration-500"
        style={{
          background: `linear-gradient(145deg, ${themeColor}18, ${themeColor}08, rgba(255,255,255,0.03))`,
          border: `1px solid ${themeColor}30`,
          boxShadow: `0 0 40px ${themeColor}10, 0 4px 20px rgba(0,0,0,0.3)`,
        }}
      >
        <button
          className="w-full px-5 py-5 flex items-center gap-4 text-left transition-colors"
          onClick={() => setExpandedProduct(isExpanded ? null : mp.id)}
        >
          {product.page_logo ? (
            <div className="relative">
              <img
                src={product.page_logo}
                alt={product.name}
                className="h-16 w-16 rounded-2xl object-cover shrink-0"
                style={{ boxShadow: `0 4px 20px ${themeColor}30` }}
              />
              <div
                className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: themeColor }}
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </div>
            </div>
          ) : (
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}15)`,
                boxShadow: `0 4px 20px ${themeColor}20`,
              }}
            >
              <ShoppingBag className="h-7 w-7" style={{ color: themeColor }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base truncate">{product.name}</h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: themeColor }} />
              <span
                className="text-[11px] font-bold tracking-wide uppercase"
                style={{ color: themeColor }}
              >
                Desbloqueado
              </span>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-slate-500 transition-transform duration-500 shrink-0 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
        {isExpanded && (
          <div className="px-5 pb-5 border-t" style={{ borderColor: `${themeColor}15` }}>
            <div className="pt-4">
              <ProductContentViewer productId={mp.product_id} productName={product.name} themeColor={themeColor} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProductCard = (mp: MemberProduct) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const isExpanded = expandedProduct === mp.id;

    return (
      <div
        key={mp.id}
        className="rounded-2xl overflow-hidden transition-all duration-400 hover:bg-white/[0.06]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left"
          onClick={() => setExpandedProduct(isExpanded ? null : mp.id)}
        >
          {product.page_logo ? (
            <div className="relative">
              <img
                src={product.page_logo}
                alt={product.name}
                className="h-12 w-12 rounded-xl object-cover shrink-0"
                style={{ border: `2px solid ${themeColor}25` }}
              />
              <div
                className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#10b981" }}
              >
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              </div>
            </div>
          ) : (
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}
            >
              <ShoppingBag className="h-5 w-5" style={{ color: themeColor }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white/90 text-sm truncate">{product.name}</h3>
            <span className="text-[11px] font-medium text-emerald-400/80 mt-0.5 block">Liberado</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-600 transition-transform duration-300 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-white/[0.06]">
            <div className="pt-4">
              <ProductContentViewer productId={mp.product_id} productName={product.name} themeColor={themeColor} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Determine the greeting text: AI > settings > default
  const greetingText = aiContext?.greeting || settings?.welcome_message || "Sua área exclusiva";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Gradient accent bar */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80, ${themeColor})`,
        }}
      />

      {/* Header — Premium glassmorphism */}
      <header
        className="backdrop-blur-xl border-b"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-2xl mx-auto px-5 py-6 flex items-center gap-4">
          {settings?.logo_url && (
            <div className="relative shrink-0">
              <img
                src={settings.logo_url}
                alt="Logo"
                className="h-14 w-14 rounded-2xl object-cover"
                style={{
                  boxShadow: `0 0 25px ${themeColor}25, 0 4px 12px rgba(0,0,0,0.4)`,
                  border: `2px solid ${themeColor}30`,
                }}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Olá, {firstName}
            </h1>
            <p
              className="text-sm text-slate-400 mt-0.5 leading-relaxed line-clamp-2 transition-opacity duration-700"
              style={{ opacity: aiContext?.greeting ? 1 : 0.7 }}
            >
              {greetingText}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-6 pb-20 space-y-4">
        {/* Hero product — first/newest */}
        {sortedProducts.length > 0 && renderHeroProduct(sortedProducts[0])}

        {/* AI suggested offer — between hero and rest */}
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

        {/* AI personal message — inline, no card chrome */}
        {aiContext?.tip && (
          <p
            className="text-sm text-slate-400 italic leading-relaxed px-1 transition-opacity duration-700"
            style={{ opacity: 1 }}
          >
            {aiContext.tip}
          </p>
        )}

        {/* Remaining products */}
        {sortedProducts.length > 1 && (
          <div className="space-y-3">
            {sortedProducts.slice(1).map((mp) => renderProductCard(mp))}
          </div>
        )}

        {/* Daily Verse */}
        <DailyVerse />

        {/* Remaining offers */}
        {(() => {
          const filteredOffers = aiContext?.offerSuggestion?.offerId
            ? offers.filter((o: any) => o.id !== aiContext.offerSuggestion.offerId)
            : offers;
          return filteredOffers.length > 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider px-1">
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

      <footer
        className="text-center py-6 border-t"
        style={{
          borderColor: "rgba(255,255,255,0.04)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <p className="text-[11px] text-slate-600">Área exclusiva para membros ✝️</p>
      </footer>
    </div>
  );
}
