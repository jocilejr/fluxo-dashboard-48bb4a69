import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ShoppingBag, ChevronDown, Sparkles } from "lucide-react";
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

const GREETING_CACHE_KEY = "member_ai_greeting";
const GREETING_TTL = 24 * 60 * 60 * 1000;

export default function AreaMembrosPublica() {
  const { phone } = useParams<{ phone: string }>();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MemberProduct[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [settings, setSettings] = useState<MemberSettings | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [aiGreeting, setAiGreeting] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) return;
    loadMemberData();
  }, [phone]);

  const loadMemberData = async () => {
    if (!phone) return;
    setLoading(true);
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
    setProducts(memberProds);
    setOffers((offersRes.data || []) as any[]);
    setSettings(
      settingsRes.data
        ? (settingsRes.data as unknown as MemberSettings)
        : { title: "Área de Membros", logo_url: null, welcome_message: "Bem-vinda à sua área exclusiva! 🎉", theme_color: "#8B5CF6" }
    );
    const name = customerRes.data?.name || null;
    setCustomerName(name);

    const sorted = [...memberProds].sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime());
    if (sorted.length > 0) setExpandedProduct(sorted[0].id);

    loadAiGreeting(name, memberProds);
    setLoading(false);
  };

  const loadAiGreeting = async (name: string | null, prods: MemberProduct[]) => {
    const cacheKey = `${GREETING_CACHE_KEY}_${phone}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < GREETING_TTL) {
          setAiGreeting(parsed.message);
          return;
        }
      }
    } catch {}

    try {
      const firstName = name?.split(" ")[0] || "Querido(a)";
      const productList = prods
        .filter(p => p.delivery_products)
        .map(p => ({ name: p.delivery_products!.name, materialCount: 0 }));

      const { data, error } = await supabase.functions.invoke("member-greeting", {
        body: { firstName, products: productList },
      });

      if (!error && data?.message) {
        setAiGreeting(data.message);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ message: data.message, cachedAt: Date.now() }));
        } catch {}
      }
    } catch {}
  };

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime());
  }, [products]);

  const firstName = customerName?.split(" ")[0] || "Querido(a)";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-amber-50/30">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500/60 mx-auto" />
          <p className="text-gray-400 text-sm">Preparando sua área...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-amber-50/30 p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Crown className="h-10 w-10 text-gray-300" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Área não encontrada</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Não encontramos produtos liberados para este número.</p>
        </div>
      </div>
    );
  }

  const themeColor = settings?.theme_color || "#8B5CF6";

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${themeColor}, ${themeColor}dd, ${themeColor}aa)` }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`, backgroundSize: '40px 40px, 60px 60px' }} />
        
        <div className="relative max-w-3xl mx-auto px-5 py-12 sm:py-16 text-center text-white">
          {settings?.logo_url && (
            <div className="mb-5">
              <img src={settings.logo_url} alt="Logo" className="h-16 w-16 rounded-2xl mx-auto shadow-xl border-2 border-white/20 object-cover" />
            </div>
          )}
          <p className="text-xl sm:text-2xl font-bold tracking-tight leading-relaxed max-w-md mx-auto">
            Olá, <span className="font-extrabold">{firstName}</span>! {settings?.welcome_message}
          </p>
        </div>
        
        {/* Curved bottom */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60V20C360 0 720 0 1080 20C1260 30 1380 45 1440 60H0Z" fill="url(#bg-gradient)" />
            <defs>
              <linearGradient id="bg-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fafaf9" />
                <stop offset="1" stopColor="white" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 pb-20 space-y-8 -mt-1">
        {/* AI Greeting */}
        {aiGreeting && (
          <div className="flex items-start gap-3.5 rounded-2xl bg-white shadow-sm border border-gray-100 px-5 py-4">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}08)` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: themeColor }} />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed pt-1.5">{aiGreeting}</p>
          </div>
        )}

        {/* Products with DailyVerse between 1st and 2nd */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}12` }}>
              <Crown className="h-4 w-4" style={{ color: themeColor }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Seus Conteúdos</h2>
              <p className="text-xs text-gray-400">{products.length} {products.length === 1 ? 'produto liberado' : 'produtos liberados'}</p>
            </div>
          </div>

          <div className="space-y-4">
            {sortedProducts.map((mp, index) => {
              const product = mp.delivery_products;
              if (!product) return null;
              const isExpanded = expandedProduct === mp.id;

              return (
                <div key={mp.id}>
                  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-md">
                    <button
                      className="w-full px-5 py-4 flex items-center gap-4 text-left transition-colors hover:bg-gray-50/50"
                      onClick={() => setExpandedProduct(isExpanded ? null : mp.id)}
                    >
                      {product.page_logo ? (
                        <img src={product.page_logo} alt={product.name} className="h-12 w-12 rounded-xl object-cover shrink-0 shadow-sm" />
                      ) : (
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `linear-gradient(135deg, ${themeColor}18, ${themeColor}08)` }}
                        >
                          <ShoppingBag className="h-5 w-5" style={{ color: themeColor }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-[15px] truncate">{product.name}</h3>
                        {index === 0 && (
                          <span
                            className="inline-block text-[10px] font-bold uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${themeColor}12`, color: themeColor }}
                          >
                            ✨ Mais recente
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-300 transition-transform duration-300 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-gray-50">
                        <div className="pt-5">
                          <ProductContentViewer productId={mp.product_id} productName={product.name} themeColor={themeColor} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* DailyVerse between 1st and 2nd product */}
                  {index === 0 && sortedProducts.length > 1 && (
                    <div className="mt-4">
                      <DailyVerse />
                    </div>
                  )}
                </div>
              );
            })}

            {/* If only 1 product, show verse after it */}
            {sortedProducts.length === 1 && (
              <DailyVerse />
            )}
          </div>
        </section>

        {/* Locked Offers */}
        {offers.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <span className="text-base">🔒</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Conteúdos Exclusivos</h2>
                <p className="text-xs text-gray-400">Descubra mais conteúdos para sua jornada</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {offers.map((offer: any) => (
                <LockedOfferCard key={offer.id} offer={offer} themeColor={themeColor} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">Área exclusiva para membros ✝️</p>
      </footer>
    </div>
  );
}
