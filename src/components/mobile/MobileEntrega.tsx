import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { 
  Search, 
  Package, 
  Phone,
  ArrowRight,
  Copy,
  ExternalLink,
  Check,
  ArrowLeft,
  CreditCard,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizePhoneForMatching } from "@/lib/phoneNormalization";

interface DeliveryProduct {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  whatsapp_message: string | null;
  redirect_url: string | null;
  is_active: boolean;
  value: number;
}

type Step = "phone" | "payment" | "link";
type PaymentMethod = "pix" | "cartao_boleto";

export function MobileEntrega() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<DeliveryProduct | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkMessageTemplate, setLinkMessageTemplate] = useState<string>("{link}");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["delivery-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_products")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as DeliveryProduct[];
    },
  });

  // Load link message template
  useQuery({
    queryKey: ["delivery-settings-message"],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_settings")
        .select("link_message_template")
        .limit(1)
        .single();

      if (data?.link_message_template) {
        setLinkMessageTemplate(data.link_message_template);
      }
      return data;
    },
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.slug.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleContinueToPayment = () => {
    const cleanPhone = phoneInput.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um telefone válido");
      return;
    }
    setStep("payment");
  };

  const handleSelectPayment = async (method: PaymentMethod) => {
    if (!selectedProduct) return;
    
    setPaymentMethod(method);

    const cleanPhone = phoneInput.replace(/\D/g, "");
    const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/e/${selectedProduct.slug}?telefone=${cleanPhone}`;
    setGeneratedLink(link);

    // Log the link generation
    await supabase.from("delivery_link_generations").insert({
      product_id: selectedProduct.id,
      phone: phoneInput,
      normalized_phone: normalizedPhone,
      payment_method: method === "pix" ? "pix" : "cartao_boleto",
    });

    // If PIX, update customer stats
    if (method === "pix") {
      const normalized = normalizePhoneForMatching(phoneInput);
      
      if (normalized) {
        // Check if customer exists
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id, pix_payment_count, total_paid")
          .eq("normalized_phone", normalized)
          .single();

        if (existingCustomer) {
          // Update existing customer
          await supabase
            .from("customers")
            .update({
              pix_payment_count: (existingCustomer.pix_payment_count || 0) + 1,
              total_paid: (existingCustomer.total_paid || 0) + (selectedProduct.value || 0),
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", existingCustomer.id);
        } else {
          // Create new customer
          await supabase
            .from("customers")
            .insert({
              normalized_phone: normalized,
              display_phone: phoneInput,
              pix_payment_count: 1,
              total_paid: selectedProduct.value || 0,
              first_seen_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
            });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }

    setStep("link");
  };

  const handleCopyLink = () => {
    const messageWithLink = linkMessageTemplate.replace("{link}", generatedLink);
    navigator.clipboard.writeText(messageWithLink);
    setCopiedLink(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!selectedProduct) return;
    
    const cleanPhone = phoneInput.replace(/\D/g, "");
    const formatted = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    
    const messageWithLink = linkMessageTemplate.replace("{link}", generatedLink);
    
    window.open(`https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(messageWithLink)}`, "_blank");
  };

  const resetFlow = () => {
    setSelectedProduct(null);
    setPhoneInput("");
    setStep("phone");
    setPaymentMethod(null);
    setGeneratedLink("");
    setCopiedLink(false);
  };

  const handleBack = () => {
    if (step === "payment") {
      setStep("phone");
    } else if (step === "link") {
      setStep("payment");
      setPaymentMethod(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card/50 rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-muted rounded w-32 mb-2" />
            <div className="h-4 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  // Product selection view
  if (!selectedProduct) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/30 border-border/30"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Selecione um produto para gerar link
          </p>
        </div>

        {/* Products List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="w-full bg-card/50 border border-border/30 rounded-xl p-4 text-left transition-all active:scale-[0.98] hover:bg-card/80"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(product.value || 0)}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Step-based flow
  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={step === "phone" ? resetFlow : handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-medium text-sm">{selectedProduct.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(selectedProduct.value || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Step 1: Phone Input */}
        {step === "phone" && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Telefone do Cliente</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Digite o número para gerar o link
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Ex: 11999999999"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="pl-12 h-14 text-lg bg-secondary/30 border-border/30"
                  type="tel"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleContinueToPayment}
                className="w-full h-14 text-base gap-2 bg-primary hover:bg-primary/90"
                disabled={phoneInput.replace(/\D/g, "").length < 10}
              >
                Continuar
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === "payment" && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold">Método de Pagamento</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha a forma de pagamento
              </p>
            </div>

            <div className="space-y-3">
              <Card
                className={cn(
                  "p-4 cursor-pointer transition-all border-2 active:scale-[0.98]",
                  "hover:bg-success/5 border-border/30 hover:border-success/50"
                )}
                onClick={() => handleSelectPayment("pix")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-success/20 rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">PIX</p>
                    <p className="text-xs text-muted-foreground">
                      Pagamento instantâneo
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card
                className={cn(
                  "p-4 cursor-pointer transition-all border-2 active:scale-[0.98]",
                  "hover:bg-primary/5 border-border/30 hover:border-primary/50"
                )}
                onClick={() => handleSelectPayment("cartao_boleto")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Cartão / Boleto</p>
                    <p className="text-xs text-muted-foreground">
                      Cartão de crédito ou boleto bancário
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Step 3: Generated Link */}
        {step === "link" && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-success/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-lg font-semibold">Link Gerado!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentMethod === "pix" 
                  ? "Cliente atualizado com sucesso" 
                  : "Copie o link ou envie via WhatsApp"}
              </p>
            </div>

            <Card className="p-4 bg-secondary/30 border-border/30">
              <p className="text-xs text-muted-foreground break-all font-mono">
                {generatedLink}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="h-14 gap-2"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-5 w-5 text-success" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5" />
                    Copiar
                  </>
                )}
              </Button>
              <Button
                onClick={handleOpenWhatsApp}
                className="h-14 gap-2 bg-success hover:bg-success/90"
              >
                <ExternalLink className="h-5 w-5" />
                WhatsApp
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={resetFlow}
              className="w-full"
            >
              Gerar outro link
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
