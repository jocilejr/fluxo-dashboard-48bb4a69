import { useEffect, useState } from "react";
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

        // Fire pixels if first access
        if (!data.already_accessed && data.pixels?.length > 0) {
          firePixels(data.pixels, data.product.value || 0);
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

  // Fire tracking pixels with value
  const firePixels = (pixels: PixelInfo[], value: number) => {
    pixels.forEach((pixel) => {
      try {
        switch (pixel.platform) {
          case "meta":
            if (typeof (window as any).fbq === "function") {
              (window as any).fbq("track", pixel.event_name || "Purchase", {
                value: value,
                currency: "BRL",
              });
              console.log(`[Pixel] Meta ${pixel.event_name} fired with value ${value}`);
            }
            break;
          case "tiktok":
            if (typeof (window as any).ttq === "object") {
              (window as any).ttq.track(pixel.event_name || "CompletePayment", {
                value: value,
                currency: "BRL",
              });
              console.log(`[Pixel] TikTok ${pixel.event_name} fired with value ${value}`);
            }
            break;
          case "google":
            if (typeof (window as any).gtag === "function") {
              (window as any).gtag("event", "conversion", {
                send_to: pixel.pixel_id,
                value: value,
                currency: "BRL",
              });
              console.log(`[Pixel] Google conversion fired with value ${value}`);
            }
            break;
          case "pinterest":
            if (typeof (window as any).pintrk === "function") {
              (window as any).pintrk("track", pixel.event_name || "checkout", {
                value: value,
                currency: "BRL",
              });
              console.log(`[Pixel] Pinterest ${pixel.event_name} fired with value ${value}`);
            }
            break;
          case "taboola":
            if (typeof (window as any)._tfa === "object") {
              (window as any)._tfa.push({ 
                notify: "event", 
                name: pixel.event_name || "purchase",
                revenue: value,
              });
              console.log(`[Pixel] Taboola ${pixel.event_name} fired with value ${value}`);
            }
            break;
        }
      } catch (err) {
        console.error(`Error firing ${pixel.platform} pixel:`, err);
      }
    });
  };

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
