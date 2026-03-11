import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ShoppingBag, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DailyVerse from "@/components/membros/DailyVerse";
import ProductContentViewer from "@/components/membros/ProductContentViewer";
import LockedOfferCard from "@/components/membros/LockedOfferCard";

interface MemberProduct {
  id: string;
  normalized_phone: string;
  product_id: string;
  is_active: boolean;
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

    // Filter offers to only show ones the member doesn't already own
    const ownedProductIds = new Set(memberProds.map(mp => mp.product_id));
    const allOffers = (offersRes.data || []) as any[];
    setOffers(allOffers);

    setSettings(
      settingsRes.data
        ? (settingsRes.data as unknown as MemberSettings)
        : { title: "Área de Membros", logo_url: null, welcome_message: "Que Deus abençoe sua jornada! 🙏", theme_color: "#B8860B" }
    );
    setCustomerName(customerRes.data?.name || null);
    setLoading(false);
  };

  const firstName = customerName?.split(" ")[0] || "Querido(a)";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-yellow-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-amber-700 mx-auto" />
          <p className="text-amber-800/70">Preparando sua área...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-4">
        <div className="text-center space-y-4 max-w-md">
          <Crown className="h-16 w-16 text-amber-300 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">Área não encontrada</h1>
          <p className="text-gray-500">Não encontramos produtos liberados para este número. Verifique se o link está correto ou entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  const themeColor = settings?.theme_color || "#B8860B";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      {/* Header */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative max-w-4xl mx-auto px-4 py-10 sm:py-14 text-center text-white">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="h-16 w-16 rounded-2xl mx-auto mb-4 shadow-lg border-2 border-white/30" />
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{settings?.title || "Área de Membros"}</h1>
          <p className="text-white/90 text-lg">
            Olá, <span className="font-semibold">{firstName}</span>! {settings?.welcome_message}
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-amber-50 to-transparent" />
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-2 pb-16 space-y-8">
        {/* Daily Verse */}
        <DailyVerse />

        {/* Products Section */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Crown className="h-5 w-5" style={{ color: themeColor }} />
            <h2 className="text-xl font-bold text-gray-800">Seus Conteúdos</h2>
            <Badge variant="secondary" className="ml-auto">{products.length} {products.length === 1 ? "produto" : "produtos"}</Badge>
          </div>

          <div className="space-y-3">
            {products.map((mp) => {
              const product = mp.delivery_products;
              if (!product) return null;
              const isExpanded = expandedProduct === mp.id;

              return (
                <Card key={mp.id} className="overflow-hidden border-amber-100 hover:border-amber-300 transition-all duration-300">
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left"
                    onClick={() => setExpandedProduct(isExpanded ? null : mp.id)}
                  >
                    {product.page_logo ? (
                      <img src={product.page_logo} alt={product.name} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${themeColor}15` }}>
                        <ShoppingBag className="h-6 w-6" style={{ color: themeColor }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate">{product.name}</h3>
                      {product.value ? (
                        <p className="text-sm text-gray-500">R$ {product.value.toFixed(2).replace(".", ",")}</p>
                      ) : null}
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-300 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <CardContent className="px-4 pb-4 pt-0 border-t border-amber-100">
                      <div className="pt-4">
                        <ProductContentViewer productId={mp.product_id} productName={product.name} themeColor={themeColor} />
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {/* Locked Offers */}
        {offers.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🔒</span>
              <h2 className="text-xl font-bold text-gray-800">Conteúdos Exclusivos</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Descubra mais conteúdos especiais para enriquecer sua fé:</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer: any) => (
                <LockedOfferCard key={offer.id} offer={offer} themeColor={themeColor} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-6 text-sm text-gray-400 border-t border-amber-100">
        <p>Área exclusiva para membros ✝️</p>
      </footer>
    </div>
  );
}
