import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface ProductInfo {
  name: string;
  page_title: string;
  page_message: string;
  page_logo: string | null;
  redirect_delay: number;
  value: number;
}

interface PixelInfo {
  platform: string;
  pixel_id: string;
  event_name: string;
}

// Declare global window types for pixels
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    ttq: any;
    TiktokAnalyticsObject: string;
    gtag: any;
    dataLayer: any[];
    pintrk: any;
    _tfa: any[];
  }
}

const EntregaPublica = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const telefone = searchParams.get("telefone");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [alreadyAccessed, setAlreadyAccessed] = useState(false);
  const [pixelsFired, setPixelsFired] = useState(false);
  const pixelsRef = useRef<PixelInfo[]>([]);

  // Load and fire Meta Pixel
  const loadMetaPixel = (pixelId: string, eventName: string, value: number) => {
    console.log(`[Pixel] Loading Meta Pixel: ${pixelId}`);
    
    // Initialize fbq function
    if (!window.fbq) {
      const n: any = window.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
    }

    // Load script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = () => {
      console.log(`[Pixel] Meta script loaded`);
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
      window.fbq('track', eventName || 'Purchase', {
        value: value,
        currency: 'BRL',
      });
      console.log(`[Pixel] Meta ${eventName} fired with value ${value}`);
    };
    script.onerror = () => {
      console.error(`[Pixel] Failed to load Meta script`);
    };
    document.head.appendChild(script);

    // Also fire via noscript img fallback for reliability
    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=${eventName || 'Purchase'}&cd[value]=${value}&cd[currency]=BRL&noscript=1`;
    document.body.appendChild(img);
  };

  // Load and fire TikTok Pixel
  const loadTikTokPixel = (pixelId: string, eventName: string, value: number) => {
    console.log(`[Pixel] Loading TikTok Pixel: ${pixelId}`);
    
    // Initialize ttq
    if (!window.ttq) {
      window.TiktokAnalyticsObject = 'ttq';
      const ttq: any = window.ttq = window.ttq || [];
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function(t: any, e: string) {
        t[e] = function() {
          t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (let i = 0; i < ttq.methods.length; i++) {
        ttq.setAndDefer(ttq, ttq.methods[i]);
      }
      ttq.instance = function(t: string) {
        const e = ttq._i[t] || [];
        for (let n = 0; n < ttq.methods.length; n++) {
          ttq.setAndDefer(e, ttq.methods[n]);
        }
        return e;
      };
      ttq.load = function(e: string, n?: any) {
        const i = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = i;
        ttq._t = ttq._t || {};
        ttq._t[e] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[e] = n || {};
        const o = document.createElement("script");
        o.type = "text/javascript";
        o.async = true;
        o.src = i + "?sdkid=" + e + "&lib=" + 'ttq';
        const a = document.getElementsByTagName("script")[0];
        a.parentNode?.insertBefore(o, a);
      };
    }

    window.ttq.load(pixelId);
    window.ttq.page();
    
    // Fire event after a small delay to ensure script is loaded
    setTimeout(() => {
      window.ttq.track(eventName || 'CompletePayment', {
        value: value,
        currency: 'BRL',
      });
      console.log(`[Pixel] TikTok ${eventName} fired with value ${value}`);
    }, 1000);
  };

  // Load and fire Google Tag
  const loadGoogleTag = (tagId: string, eventName: string, value: number) => {
    console.log(`[Pixel] Loading Google Tag: ${tagId}`);
    
    // Initialize dataLayer and gtag
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
    }

    // Load script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
    script.onload = () => {
      console.log(`[Pixel] Google script loaded`);
      window.gtag('config', tagId);
      window.gtag('event', 'conversion', {
        send_to: tagId,
        value: value,
        currency: 'BRL',
      });
      console.log(`[Pixel] Google conversion fired with value ${value}`);
    };
    script.onerror = () => {
      console.error(`[Pixel] Failed to load Google script`);
    };
    document.head.appendChild(script);
  };

  // Load and fire Pinterest Tag
  const loadPinterestTag = (tagId: string, eventName: string, value: number) => {
    console.log(`[Pixel] Loading Pinterest Tag: ${tagId}`);
    
    // Initialize pintrk
    if (!window.pintrk) {
      window.pintrk = function() {
        window.pintrk.queue.push(Array.prototype.slice.call(arguments));
      };
      const n: any = window.pintrk;
      n.queue = [];
      n.version = "3.0";
    }

    // Load script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://s.pinimg.com/ct/core.js';
    script.onload = () => {
      console.log(`[Pixel] Pinterest script loaded`);
      window.pintrk('load', tagId);
      window.pintrk('page');
      window.pintrk('track', eventName || 'checkout', {
        value: value,
        currency: 'BRL',
      });
      console.log(`[Pixel] Pinterest ${eventName} fired with value ${value}`);
    };
    script.onerror = () => {
      console.error(`[Pixel] Failed to load Pinterest script`);
    };
    document.head.appendChild(script);
  };

  // Load and fire Taboola Pixel
  const loadTaboolaPixel = (pixelId: string, eventName: string, value: number) => {
    console.log(`[Pixel] Loading Taboola Pixel: ${pixelId}`);
    
    // Initialize _tfa
    window._tfa = window._tfa || [];
    window._tfa.push({ notify: 'event', name: 'page_view', id: pixelId });

    // Load script
    const script = document.createElement('script');
    script.async = true;
    script.src = `//cdn.taboola.com/libtrc/unip/${pixelId}/tfa.js`;
    script.onload = () => {
      console.log(`[Pixel] Taboola script loaded`);
      window._tfa.push({ 
        notify: 'event', 
        name: eventName || 'purchase',
        id: pixelId,
        revenue: value,
      });
      console.log(`[Pixel] Taboola ${eventName} fired with value ${value}`);
    };
    script.onerror = () => {
      console.error(`[Pixel] Failed to load Taboola script`);
    };
    document.head.appendChild(script);
  };

  // Fire all tracking pixels with dynamic loading
  const firePixels = (pixels: PixelInfo[], value: number) => {
    console.log(`[Pixel] Firing ${pixels.length} pixels with value ${value}`);
    
    pixels.forEach((pixel) => {
      try {
        switch (pixel.platform) {
          case "meta":
            loadMetaPixel(pixel.pixel_id, pixel.event_name, value);
            break;
          case "tiktok":
            loadTikTokPixel(pixel.pixel_id, pixel.event_name, value);
            break;
          case "google":
            loadGoogleTag(pixel.pixel_id, pixel.event_name, value);
            break;
          case "pinterest":
            loadPinterestTag(pixel.pixel_id, pixel.event_name, value);
            break;
          case "taboola":
            loadTaboolaPixel(pixel.pixel_id, pixel.event_name, value);
            break;
          default:
            console.warn(`[Pixel] Unknown platform: ${pixel.platform}`);
        }
      } catch (err) {
        console.error(`[Pixel] Error firing ${pixel.platform} pixel:`, err);
      }
    });
    
    setPixelsFired(true);
  };

  useEffect(() => {
    if (!slug || !telefone) {
      setError("Link inválido. Verifique a URL e tente novamente.");
      setLoading(false);
      return;
    }

    const processAccess = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("delivery-access", {
          body: { slug, phone: telefone },
        });

        if (fnError || data?.error) {
          setError(data?.error || "Produto não encontrado ou link inválido.");
          setLoading(false);
          return;
        }

        setProduct(data.product);
        setRedirectUrl(data.redirect_url);
        setAlreadyAccessed(data.already_accessed);
        setCountdown(data.product.redirect_delay || 3);

        // Store pixels for firing
        if (!data.already_accessed && data.pixels?.length > 0) {
          pixelsRef.current = data.pixels;
        }

        setLoading(false);
      } catch (err) {
        console.error("Error processing access:", err);
        setError("Erro ao processar acesso. Tente novamente.");
        setLoading(false);
      }
    };

    processAccess();
  }, [slug, telefone]);

  // Fire pixels after component is mounted and ready
  useEffect(() => {
    if (!loading && !error && product && pixelsRef.current.length > 0 && !pixelsFired) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        firePixels(pixelsRef.current, product.value || 0);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, error, product, pixelsFired]);

  // Countdown and redirect
  useEffect(() => {
    if (!loading && !error && redirectUrl && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0 && redirectUrl) {
      window.location.href = redirectUrl;
    }
  }, [loading, error, redirectUrl, countdown]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Processando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Ops!</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        {product?.page_logo && (
          <img
            src={product.page_logo}
            alt={product.name}
            className="h-20 w-auto mx-auto object-contain"
          />
        )}

        <div className="space-y-2">
          <CheckCircle className="h-16 w-16 text-success mx-auto" />
          <h1 className="text-2xl font-bold">{product?.page_title || "Preparando sua entrega..."}</h1>
          <p className="text-muted-foreground">
            {product?.page_message || "Você será redirecionado em instantes"}
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-4xl font-bold text-primary">{countdown}</div>
          <p className="text-sm text-muted-foreground">
            {alreadyAccessed
              ? "Redirecionando para o WhatsApp..."
              : "Preparando sua entrega..."}
          </p>
        </div>

        <div className="pt-4">
          <p className="text-xs text-muted-foreground">
            Produto: {product?.name}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EntregaPublica;
