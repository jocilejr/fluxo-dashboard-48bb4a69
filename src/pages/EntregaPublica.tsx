import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { firePixels, type PixelInfo } from "@/lib/pixelFiring";

interface ProductInfo {
  name: string;
  page_title: string;
  page_message: string;
  page_logo: string | null;
  redirect_delay: number;
  value: number;
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
      const timer = setTimeout(() => {
        firePixels(pixelsRef.current, product.value || 0, telefone);
        setPixelsFired(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, error, product, pixelsFired, telefone]);

  // Countdown and redirect
  useEffect(() => {
    if (!loading && !error && redirectUrl && countdown > 0) {
      const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
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
          <img src={product.page_logo} alt={product.name} className="h-20 w-auto mx-auto object-contain" />
        )}
        <div className="space-y-2">
          <CheckCircle className="h-16 w-16 text-success mx-auto" />
          <h1 className="text-2xl font-bold">{product?.page_title || "Preparando sua entrega..."}</h1>
          <p className="text-muted-foreground">{product?.page_message || "Você será redirecionado em instantes"}</p>
        </div>
        <div className="space-y-2">
          <div className="text-4xl font-bold text-primary">{countdown}</div>
          <p className="text-sm text-muted-foreground">
            {alreadyAccessed ? "Redirecionando para o WhatsApp..." : "Preparando sua entrega..."}
          </p>
        </div>
        <div className="pt-4">
          <p className="text-xs text-muted-foreground">Produto: {product?.name}</p>
        </div>
      </div>
    </div>
  );
};

export default EntregaPublica;
