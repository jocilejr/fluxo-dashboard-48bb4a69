import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ExternalLink, ShoppingBag, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface MemberOffer {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  purchase_url: string;
  price: number | null;
  sort_order: number;
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
  const [offers, setOffers] = useState<MemberOffer[]>([]);
  const [settings, setSettings] = useState<MemberSettings | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!phone) return;
    loadMemberData();
  }, [phone]);

  const loadMemberData = async () => {
    if (!phone) return;
    setLoading(true);

    const digits = phone.replace(/\D/g, "");
    const variations = generatePhoneVariations(digits);

    if (variations.length === 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Fetch all in parallel
    const [productsRes, settingsRes, offersRes, customerRes] = await Promise.all([
      supabase
        .from("member_products")
        .select("*, delivery_products(name, slug, redirect_url, page_logo, value)")
        .in("normalized_phone", variations)
        .eq("is_active", true),
      supabase.from("member_area_settings").select("*").limit(1).maybeSingle(),
      supabase
        .from("member_area_offers")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("customers")
        .select("name, display_phone")
        .in("normalized_phone", variations)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!productsRes.data || productsRes.data.length === 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProducts(productsRes.data as unknown as MemberProduct[]);
    setOffers((offersRes.data as MemberOffer[]) || []);
    setSettings(
      settingsRes.data
        ? (settingsRes.data as unknown as MemberSettings)
        : { title: "Área de Membros", logo_url: null, welcome_message: "Bem-vinda à sua área exclusiva! 🎉", theme_color: "#8B5CF6" }
    );
    setCustomerName(customerRes.data?.name || null);
    setLoading(false);
  };

  const firstName = customerName?.split(" ")[0] || "Membro";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-violet-600 mx-auto" />
          <p className="text-muted-foreground">Carregando sua área...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 p-4">
        <div className="text-center space-y-4 max-w-md">
          <Crown className="h-16 w-16 text-violet-300 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">Área não encontrada</h1>
          <p className="text-muted-foreground">
            Não encontramos produtos liberados para este número. Verifique se o link está correto ou entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  const themeColor = settings?.theme_color || "#8B5CF6";

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Header */}
      <header
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-4xl mx-auto px-4 py-10 sm:py-14 text-center text-white">
          {settings?.logo_url && (
            <img
              src={settings.logo_url}
              alt="Logo"
              className="h-16 w-16 rounded-2xl mx-auto mb-4 shadow-lg"
            />
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{settings?.title || "Área de Membros"}</h1>
          <p className="text-white/90 text-lg">
            Olá, <span className="font-semibold">{firstName}</span>! {settings?.welcome_message}
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-violet-50 to-transparent" />
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-4 pb-16">
        {/* Products Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Crown className="h-5 w-5 text-violet-600" />
            <h2 className="text-xl font-bold text-gray-800">Seus Produtos</h2>
            <Badge variant="secondary" className="ml-auto">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((mp) => {
              const product = mp.delivery_products;
              if (!product) return null;
              const accessUrl = product.redirect_url || `/e/${product.slug}?telefone=${phone}`;

              return (
                <Card
                  key={mp.id}
                  className="group hover:shadow-lg transition-all duration-300 border-violet-100 hover:border-violet-300 overflow-hidden"
                >
                  <CardContent className="p-0">
                    <div className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        {product.page_logo ? (
                          <img
                            src={product.page_logo}
                            alt={product.name}
                            className="h-12 w-12 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${themeColor}20` }}
                          >
                            <ShoppingBag className="h-6 w-6" style={{ color: themeColor }} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-800 truncate">{product.name}</h3>
                          {product.value ? (
                            <p className="text-sm text-muted-foreground">
                              R$ {product.value.toFixed(2).replace(".", ",")}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <Button
                        className="w-full group-hover:shadow-md transition-shadow"
                        style={{ backgroundColor: themeColor }}
                        onClick={() => window.open(accessUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Acessar Produto
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Offers Section */}
        {offers.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Heart className="h-5 w-5 text-pink-500" />
              <h2 className="text-xl font-bold text-gray-800">Ofertas Exclusivas</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <Card
                  key={offer.id}
                  className="group hover:shadow-lg transition-all duration-300 border-pink-100 hover:border-pink-300 overflow-hidden"
                >
                  {offer.image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={offer.image_url}
                        alt={offer.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <CardContent className="p-5 space-y-3">
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
                      variant="outline"
                      className="w-full border-pink-200 hover:bg-pink-50 text-pink-600"
                      onClick={() => window.open(offer.purchase_url, "_blank")}
                    >
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Quero esse!
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-muted-foreground border-t">
        <p>Área exclusiva para membros</p>
      </footer>
    </div>
  );
}
