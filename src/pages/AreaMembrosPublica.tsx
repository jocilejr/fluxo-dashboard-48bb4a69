import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { firePixels, type PixelInfo } from "@/lib/pixelFiring";
import { Loader2, Crown, ShoppingBag, Check, Lock, BookOpen, Play } from "lucide-react";
import DailyVerse from "@/components/membros/DailyVerse";
import ProductContentViewer from "@/components/membros/ProductContentViewer";
import LockedOfferCard from "@/components/membros/LockedOfferCard";
import BottomPageOffer from "@/components/membros/BottomPageOffer";
import PhysicalProductShowcase from "@/components/membros/PhysicalProductShowcase";
import FloatingOfferBar from "@/components/membros/FloatingOfferBar";
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
    member_cover_image: string | null;
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
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, ContentProgress[]>>({});
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [materialsByProduct, setMaterialsByProduct] = useState<Record<string, any[]>>({});
  const [offerImpressions, setOfferImpressions] = useState<Record<string, { impression_count: number; clicked: boolean }>>({});

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
      supabase.from("member_products").select("*, delivery_products(name, slug, redirect_url, page_logo, value, member_cover_image, member_description)").in("normalized_phone", variations).eq("is_active", true),
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

    // Load offer impressions for rotation
    const impressionsRes = await supabase
      .from("member_offer_impressions")
      .select("offer_id, impression_count, clicked")
      .eq("normalized_phone", digits);
    const impMap: Record<string, { impression_count: number; clicked: boolean }> = {};
    (impressionsRes.data || []).forEach((imp: any) => {
      impMap[imp.offer_id] = { impression_count: imp.impression_count, clicked: imp.clicked };
    });
    setOfferImpressions(impMap);

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
          setTimeout(() => setVisibleMessages(1), 600);
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

      const ownedProductNamesPayload = prods
        .filter(p => p.delivery_products)
        .map(p => p.delivery_products!.name);

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

      const memberSince = customerProfile?.first_seen_at || prods[0]?.granted_at || null;
      const totalPaid = customerProfile?.total_paid || 0;
      const totalTransactions = customerProfile?.total_transactions || 0;
      const totalProducts = prods.length;
      
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

      const profileData: MemberProfile = {
        memberSince,
        totalPaid: Number(totalPaid),
        totalTransactions: Number(totalTransactions),
        totalProducts,
        daysSinceLastAccess,
      };
      setMemberProfile(profileData);

      const { data, error } = await supabase.functions.invoke("member-ai-context", {
        body: { firstName, products: productsPayload, ownedProductNames: ownedProductNamesPayload, progress: progressPayload, profile: profileData },
      });

      if (!error && data?.greeting) {
        const ctx: AiContext = {
          greeting: data.greeting,
          tip: data.tip || "",
        };
        setAiContext(ctx);
        setVisibleMessages(0);
        setTimeout(() => setVisibleMessages(1), 600);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data: ctx, cachedAt: Date.now() }));
        } catch {}
      }
    } catch {}
    setAiLoading(false);
  };

  // Filter out offers for products the member already owns, then sort by strategic rotation
  const filteredOffers = useMemo(() => {
    const ownedProdIds = new Set(products.map(p => p.product_id));
    const ownedProdNames = new Set(
      products.filter(p => p.delivery_products?.name).map(p => p.delivery_products!.name.toLowerCase().trim())
    );
    const available = offers.filter((offer: any) => {
      if (offer.product_id && ownedProdIds.has(offer.product_id)) return false;
      if (offer.name && ownedProdNames.has(offer.name.toLowerCase().trim())) return false;
      return true;
    });

    // Strategic rotation: prioritize unseen/fresh offers
    const getPriority = (offer: any): number => {
      const imp = offerImpressions[offer.id];
      if (!imp || imp.impression_count === 0) return 0; // Never seen — highest priority
      if (imp.impression_count === 1 && !imp.clicked) return 1; // Seen once, no click
      if (imp.clicked) return 2; // Clicked — interested
      return 3; // Seen 2x+ without click — lowest priority
    };

    // Check if ALL offers in a group have been exhausted (seen 2x+ without click)
    const allExhausted = available.every((o: any) => {
      const imp = offerImpressions[o.id];
      return imp && imp.impression_count >= 2 && !imp.clicked;
    });

    // If all exhausted, reset by treating all as equal (original sort_order)
    if (allExhausted) return available;

    return [...available].sort((a: any, b: any) => getPriority(a) - getPriority(b));
  }, [offers, products, offerImpressions]);

  const cardOffers = useMemo(() => filteredOffers.filter((o: any) => o.display_type !== "bottom_page" && o.display_type !== "showcase"), [filteredOffers]);
  const bottomPageOffers = useMemo(() => filteredOffers.filter((o: any) => o.display_type === "bottom_page"), [filteredOffers]);
  const showcaseOffers = useMemo(() => filteredOffers.filter((o: any) => o.display_type === "showcase"), [filteredOffers]);

  // Register impressions for visible offers
  useEffect(() => {
    if (!normalizedPhone || filteredOffers.length === 0) return;
    const offerIds = filteredOffers.map((o: any) => o.id);
    // Upsert impressions for all currently visible offers
    const upserts = offerIds.map((offerId: string) => ({
      normalized_phone: normalizedPhone,
      offer_id: offerId,
      impression_count: (offerImpressions[offerId]?.impression_count || 0) + 1,
      clicked: offerImpressions[offerId]?.clicked || false,
      last_shown_at: new Date().toISOString(),
    }));
    supabase
      .from("member_offer_impressions")
      .upsert(upserts, { onConflict: "normalized_phone,offer_id" })
      .then(() => {
        // Update local state
        const newMap = { ...offerImpressions };
        upserts.forEach(u => {
          newMap[u.offer_id] = { impression_count: u.impression_count, clicked: u.clicked };
        });
        setOfferImpressions(newMap);
      });
    // Only run once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedPhone, filteredOffers.length > 0]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime());
  }, [products]);

  const ownedProductNames = useMemo(() => {
    return products.filter(p => p.delivery_products).map(p => p.delivery_products!.name);
  }, [products]);

  const ownedProductIds = useMemo(() => {
    return products.map(p => p.product_id);
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
    return diffDays <= 3;
  };

  const renderProductCard = (mp: MemberProduct) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const recent = isRecent(mp.granted_at);
    const progress = getProductProgress(mp.product_id);
    const mats = materialsByProduct[mp.product_id] || [];
    const progressLabel = getProgressLabel(progress.latestProgress, mp.product_id);
    const progressPct = progress.totalMaterials > 0
      ? Math.round((progress.materialsAccessed / progress.totalMaterials) * 100)
      : 0;
    const coverSrc = product.member_cover_image || product.page_logo;

    return (
      <button
        key={mp.id}
        className="w-full rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 text-left active:scale-[0.98] group relative"
        style={{ border: `1.5px solid ${themeColor}25` }}
        onClick={() => setOpenProductId(mp.id)}
      >
        {/* Banner */}
        {coverSrc ? (
          <div className="relative h-[160px] w-full overflow-hidden">
            <img
              src={coverSrc}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white mb-2 bg-emerald-500">
                <Check className="h-3 w-3" strokeWidth={3} />
                {recent ? "Liberado recentemente" : "Liberado"}
              </span>
              <h3 className="font-black text-white text-xl leading-tight uppercase tracking-wide line-clamp-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {product.name}
              </h3>
            </div>
          </div>
        ) : (
          <div
            className="relative h-[140px] w-full flex flex-col justify-end p-4"
            style={{ background: `linear-gradient(135deg, ${themeColor}20 0%, ${themeColor}08 50%, ${themeColor}18 100%)` }}
          >
            {mats.length > 0 && mats[0]?.content_type === "video" ? (
              <Play className="absolute top-3 right-3 h-10 w-10 opacity-10" style={{ color: themeColor }} />
            ) : mats.length > 0 && mats[0]?.content_type === "pdf" ? (
              <BookOpen className="absolute top-3 right-3 h-10 w-10 opacity-10" style={{ color: themeColor }} />
            ) : (
              <ShoppingBag className="absolute top-3 right-3 h-10 w-10 opacity-10" style={{ color: themeColor }} />
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white w-fit mb-2 bg-emerald-500">
              <Check className="h-3 w-3" strokeWidth={3} />
              {recent ? "Liberado recentemente" : "Liberado"}
            </span>
            <h3 className="font-black text-gray-800 text-xl leading-tight uppercase tracking-wide line-clamp-2">
              {product.name}
            </h3>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-4 py-3.5 bg-white">
          {progress.totalMaterials > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, backgroundColor: themeColor }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-400 shrink-0">
                  {progress.materialsAccessed}/{progress.totalMaterials}
                </span>
              </div>
              {progressLabel && (
                <p className="text-xs text-gray-500 leading-tight truncate">{progressLabel}</p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-gray-500 leading-snug truncate">
              Toque para acessar seu material
            </p>
          )}
        </div>

        {/* Glow on hover */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ boxShadow: `0 0 20px ${themeColor}20, inset 0 0 20px ${themeColor}05` }}
        />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}90, ${themeColor})` }} />

      <main className="max-w-2xl mx-auto px-5 pt-6 pb-20 space-y-3">
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
            {aiLoading && visibleMessages === 0 ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-tl-md w-fit" style={{ backgroundColor: `${themeColor}10` }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "0ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "150ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: `${themeColor}80`, animationDelay: "300ms" }} />
              </div>
            ) : (
              <>
                {visibleMessages >= 1 && aiContext?.greeting && (
                  <div
                    className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed w-fit max-w-[90%] animate-fade-in"
                    style={{ backgroundColor: `${themeColor}10` }}
                  >
                    {aiContext.greeting}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Interleaved products and offers (2:1 ratio) */}
        {(() => {
          const interleaved: ({ type: "product"; data: MemberProduct } | { type: "offer"; data: any })[] = [];
          const interleavedCardOffers = cardOffers.length > 1 ? cardOffers.slice(0, -1) : cardOffers;
          let offerIdx = 0;

          for (let i = 0; i < sortedProducts.length; i++) {
            interleaved.push({ type: "product", data: sortedProducts[i] });
            if ((i + 1) % 2 === 0 && offerIdx < interleavedCardOffers.length) {
              interleaved.push({ type: "offer", data: interleavedCardOffers[offerIdx++] });
            }
          }
          while (offerIdx < interleavedCardOffers.length) {
            interleaved.push({ type: "offer", data: interleavedCardOffers[offerIdx++] });
          }

          return interleaved.map((item) => {
            if (item.type === "product") {
              return renderProductCard(item.data);
            }
            return (
              <LockedOfferCard
                key={item.data.id}
                offer={item.data}
                themeColor={themeColor}
                ownedProductNames={ownedProductNames}
                ownedProductIds={ownedProductIds}
                firstName={firstName}
                memberProfile={memberProfile}
                memberPhone={normalizedPhone}
              />
            );
          });
        })()}

        <DailyVerse />

        {/* Showcase offers (physical products) — after prayer */}
        {showcaseOffers.length > 0 && (
          <div className="space-y-2">
            {showcaseOffers.map((offer: any) => (
              <PhysicalProductShowcase key={offer.id} offer={offer} themeColor={themeColor} memberPhone={normalizedPhone} />
            ))}
          </div>
        )}

        {/* Bottom page offers */}
        {bottomPageOffers.length > 0 && (
          <div className="space-y-4 pt-4">
            {bottomPageOffers.map((offer: any) => (
              <BottomPageOffer key={offer.id} offer={offer} themeColor={themeColor} />
            ))}
          </div>
        )}
      </main>

      {/* Floating offer bar for secondary offer */}
      {cardOffers.length > 1 && (() => {
        const floatingOffer = cardOffers[cardOffers.length - 1];
        return (
          <FloatingOfferBar
            offer={floatingOffer}
            themeColor={themeColor}
            onOpenChat={() => {
              if (floatingOffer.purchase_url) {
                window.open(floatingOffer.purchase_url, "_blank");
              }
            }}
          />
        );
      })()}
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
