import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Loader2, Crown, ShoppingBag, Check, Lock, BookOpen, Play } from "lucide-react";
import DailyVerse from "@/components/membros/DailyVerse";
import ProductContentViewer from "@/components/membros/ProductContentViewer";
import LockedOfferCard from "@/components/membros/LockedOfferCard";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import meirePhoto from "@/assets/meire-rosana.png";

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
  progressMessage: string;
}

interface MemberProfile {
  memberSince: string | null;
  totalPaid: number;
  totalTransactions: number;
  totalProducts: number;
  daysSinceLastAccess: number | null;
}

interface ContentProgress {
  material_id: string;
  progress_type: string;
  current_page: number;
  total_pages: number;
  video_seconds: number;
  video_duration: number;
  last_accessed_at: string;
}

interface ProductProgress {
  materialsAccessed: number;
  totalMaterials: number;
  latestProgress: ContentProgress | null;
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
  const [progressMap, setProgressMap] = useState<Record<string, ContentProgress[]>>({});
  const [materialsByProduct, setMaterialsByProduct] = useState<Record<string, any[]>>({});

  const normalizedPhone = useMemo(() => phone?.replace(/\D/g, "") || "", [phone]);

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
      supabase.from("customers").select("name, display_phone, first_seen_at, total_paid, total_transactions, pix_payment_count").in("normalized_phone", variations).limit(1).maybeSingle(),
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
    const customerProfile = customerRes.data || null;
    setCustomerName(name);

    // Load materials and progress
    const productIds = memberProds.filter(p => p.delivery_products).map(p => p.product_id);
    const [materialsRes, progressRes] = await Promise.all([
      supabase.from("member_product_materials").select("id, product_id, title, content_type").in("product_id", productIds),
      supabase.from("member_content_progress").select("*").in("normalized_phone", variations),
    ]);

    const matsByProd: Record<string, any[]> = {};
    (materialsRes.data || []).forEach(m => {
      if (!matsByProd[m.product_id]) matsByProd[m.product_id] = [];
      matsByProd[m.product_id].push(m);
    });
    setMaterialsByProduct(matsByProd);

    const progByProd: Record<string, ContentProgress[]> = {};
    const progressData = (progressRes.data || []) as unknown as ContentProgress[];
    progressData.forEach(p => {
      // Find which product this material belongs to
      for (const [prodId, mats] of Object.entries(matsByProd)) {
        if (mats.some(m => m.id === p.material_id)) {
          if (!progByProd[prodId]) progByProd[prodId] = [];
          progByProd[prodId].push(p);
          break;
        }
      }
    });
    setProgressMap(progByProd);

    setLoading(false);
    loadAiContext(name, memberProds, memberOffers, matsByProd, progressData, customerProfile);
  };

  const getProductProgress = (productId: string): ProductProgress => {
    const mats = materialsByProduct[productId] || [];
    const progs = progressMap[productId] || [];
    const latestProgress = progs.length > 0
      ? progs.sort((a, b) => new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime())[0]
      : null;
    return {
      materialsAccessed: progs.length,
      totalMaterials: mats.length,
      latestProgress,
    };
  };

  const getProgressLabel = (progress: ContentProgress | null, productId: string): string | null => {
    if (!progress) return null;
    const mats = materialsByProduct[productId] || [];
    const mat = mats.find(m => m.id === progress.material_id);
    const matName = mat?.title || "material";

    if (progress.progress_type === "pdf" && progress.total_pages > 0) {
      return `📖 Parou na pág. ${progress.current_page} de ${progress.total_pages} — "${matName}"`;
    }
    if (progress.progress_type === "video" && progress.video_duration > 0) {
      const pct = Math.round((progress.video_seconds / progress.video_duration) * 100);
      return `▶️ Assistiu ${pct}% — "${matName}"`;
    }
    return `Último acesso: "${matName}"`;
  };

  const loadAiContext = async (name: string | null, prods: MemberProduct[], memberOffers: any[], matsByProd: Record<string, any[]>, progressData: ContentProgress[], customerProfile: any) => {
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

      const productsPayload = prods
        .filter(p => p.delivery_products)
        .map(p => ({
          name: p.delivery_products!.name,
          materials: (matsByProd[p.product_id] || []).map(m => m.title),
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

      // Build progress payload for AI
      const progressPayload = progressData.map(p => {
        let matName = "material";
        for (const mats of Object.values(matsByProd)) {
          const found = mats.find(m => m.id === p.material_id);
          if (found) { matName = found.title; break; }
        }
        return {
          materialName: matName,
          type: p.progress_type,
          currentPage: p.current_page,
          totalPages: p.total_pages,
          videoSeconds: p.video_seconds,
          videoDuration: p.video_duration,
        };
      });

      // Calculate profile metrics
      const memberSince = customerProfile?.first_seen_at || prods[0]?.granted_at || null;
      const totalPaid = customerProfile?.total_paid || 0;
      const totalTransactions = customerProfile?.total_transactions || 0;
      const totalProducts = prods.length;
      
      // Calculate days since last access from progress data
      let daysSinceLastAccess: number | null = null;
      if (progressData.length > 0) {
        const latestAccess = progressData.reduce((latest, p) => {
          const d = new Date(p.last_accessed_at).getTime();
          return d > latest ? d : latest;
        }, 0);
        if (latestAccess > 0) {
          daysSinceLastAccess = Math.floor((Date.now() - latestAccess) / (1000 * 60 * 60 * 24));
        }
      }

      const profileData = {
        memberSince,
        totalPaid: Number(totalPaid),
        totalTransactions: Number(totalTransactions),
        totalProducts,
        daysSinceLastAccess,
      };

      const { data, error } = await supabase.functions.invoke("member-ai-context", {
        body: { firstName, products: productsPayload, offers: offersPayload, ownedProductNames, progress: progressPayload, profile: profileData },
      });

      if (!error && data?.greeting) {
        const ctx: AiContext = {
          greeting: data.greeting,
          tip: data.tip || "",
          progressMessage: data.progressMessage || "",
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

  const renderProductCard = (mp: MemberProduct) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const recent = isRecent(mp.granted_at);
    const progress = getProductProgress(mp.product_id);
    const progressLabel = getProgressLabel(progress.latestProgress, mp.product_id);
    const progressPct = progress.totalMaterials > 0
      ? Math.round((progress.materialsAccessed / progress.totalMaterials) * 100)
      : 0;

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
            {progressPct > 0 && (
              <div
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center shadow-sm text-[9px] font-bold text-white"
                style={{ backgroundColor: themeColor }}
              >
                {progressPct}%
              </div>
            )}
            {progressPct === 0 && (
              <div
                className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm"
                style={{ backgroundColor: "#10b981" }}
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </div>
            )}
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
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              ✓ Liberado recentemente
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-gray-500">
              ✓ Liberado
            </span>
          )}

          {/* Progress bar */}
          {progress.totalMaterials > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, backgroundColor: themeColor }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                  {progress.materialsAccessed}/{progress.totalMaterials}
                </span>
              </div>
              {progressLabel && (
                <p className="text-[11px] text-gray-500 leading-tight truncate">
                  {progressLabel}
                </p>
              )}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}90, ${themeColor})` }} />

      <main className="max-w-2xl mx-auto px-5 pt-6 pb-20 space-y-3">
        {/* Greeting */}
        <h1 className="text-xl font-bold text-gray-800 tracking-tight px-1">
          Olá, {firstName}
        </h1>

        {/* Meire Rosana Chat Bubble */}
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: `${themeColor}0d`, borderColor: `${themeColor}22` }}>
          <div className="flex items-center gap-2.5 px-4 py-3">
            <img src={meirePhoto} alt="Meire Rosana" className="h-9 w-9 rounded-full object-cover shadow-sm" style={{ border: `2px solid ${themeColor}40` }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 leading-tight">Meire Rosana</p>
              {aiLoading && (
                <p className="text-[11px] font-medium" style={{ color: themeColor }}>digitando...</p>
              )}
            </div>
          </div>
          <div className="px-4 pb-3.5 pt-0.5 space-y-1.5">
            {aiLoading ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-tl-md w-fit" style={{ backgroundColor: `${themeColor}10` }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "0ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "150ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "300ms" }} />
              </div>
            ) : (
              <>
                {aiContext?.greeting && (
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed w-fit max-w-[90%]" style={{ backgroundColor: `${themeColor}10` }}>
                    {aiContext.greeting}
                  </div>
                )}
                {aiContext?.progressMessage && (
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed w-fit max-w-[90%]" style={{ backgroundColor: `${themeColor}10` }}>
                    {aiContext.progressMessage}
                  </div>
                )}
                {aiContext?.tip && (
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-600 leading-relaxed w-fit max-w-[90%]" style={{ backgroundColor: `${themeColor}08` }}>
                    {aiContext.tip}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Products */}
        {sortedProducts.length > 0 && renderProductCard(sortedProducts[0])}

        {/* AI suggested offer */}
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


        {/* Remaining products */}
        {sortedProducts.slice(1).map((mp) => renderProductCard(mp))}

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-white">
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
                  phone={normalizedPhone}
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
