import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, ExternalLink, CreditCard, QrCode, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DeliveryProduct {
  id: string;
  name: string;
  slug: string;
}

interface LinkGeneratorProps {
  open: boolean;
  onClose: () => void;
  product: DeliveryProduct | null;
}

type PaymentMethod = "pix" | "cartao_boleto" | null;

const LinkGenerator = ({ open, onClose, product }: LinkGeneratorProps) => {
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "payment" | "link">("phone");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);

  useEffect(() => {
    if (open) {
      loadCustomDomain();
      setStep("phone");
      setPaymentMethod(null);
    }
  }, [open]);

  const loadCustomDomain = async () => {
    try {
      const { data } = await supabase
        .from("delivery_settings")
        .select("custom_domain")
        .limit(1)
        .single();

      if (data?.custom_domain) {
        setCustomDomain(data.custom_domain);
      }
    } catch (error) {
      console.error("Erro ao carregar domínio:", error);
    }
  };

  const baseUrl = customDomain ? `https://${customDomain}` : window.location.origin;
  const cleanPhone = phone.replace(/\D/g, "");
  const generatedUrl = cleanPhone
    ? `${baseUrl}/${product?.slug}?telefone=${cleanPhone}`
    : "";

  const handleContinueToPayment = () => {
    if (!cleanPhone) {
      toast.error("Informe o telefone do cliente");
      return;
    }
    setStep("payment");
  };

  const handleSelectPayment = async (method: PaymentMethod) => {
    setPaymentMethod(method);
    
    // Registrar no banco de dados para métricas
    if (method === "pix" && cleanPhone) {
      try {
        // Atualiza ou cria o cliente com indicação de pagamento PIX
        const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("normalized_phone", normalizedPhone)
          .maybeSingle();

        if (!existingCustomer) {
          // Cria cliente se não existir
          await supabase.from("customers").insert({
            normalized_phone: normalizedPhone,
            display_phone: phone,
          });
        }
        
        toast.success("Cliente marcado como pagamento PIX");
      } catch (error) {
        console.error("Erro ao registrar pagamento:", error);
      }
    }
    
    setStep("link");
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;

    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleOpen = () => {
    if (generatedUrl) {
      window.open(generatedUrl, "_blank");
    }
  };

  const handleClose = () => {
    setPhone("");
    setCopied(false);
    setStep("phone");
    setPaymentMethod(null);
    onClose();
  };

  const handleBack = () => {
    if (step === "payment") {
      setStep("phone");
    } else if (step === "link") {
      setStep("payment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "phone" && "Gerar Link de Entrega"}
            {step === "payment" && "O pagamento foi:"}
            {step === "link" && "Link Gerado"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Phone */}
          {step === "phone" && (
            <>
              <div className="space-y-2">
                <Label>Produto</Label>
                <p className="text-sm font-medium">{product?.name}</p>
                <code className="text-xs text-muted-foreground block bg-muted p-2 rounded">
                  /{product?.slug}?telefone=XXXXX
                </code>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp do Lead *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="5511999999999"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Número com código do país (será o destino do redirecionamento)
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleContinueToPayment} disabled={!cleanPhone}>
                  Continuar
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Payment Method */}
          {step === "payment" && (
            <>
              <p className="text-sm text-muted-foreground">
                Selecione o método de pagamento para este cliente:
              </p>
              
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4 hover:bg-success/10 hover:border-success"
                  onClick={() => handleSelectPayment("pix")}
                >
                  <QrCode className="h-6 w-6 text-success" />
                  <div className="text-left">
                    <p className="font-medium">PIX</p>
                    <p className="text-xs text-muted-foreground">Pagamento instantâneo</p>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4 hover:bg-primary/10 hover:border-primary"
                  onClick={() => handleSelectPayment("cartao_boleto")}
                >
                  <div className="flex gap-1">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Cartão ou Boleto</p>
                    <p className="text-xs text-muted-foreground">Outros métodos</p>
                  </div>
                </Button>
              </div>

              <div className="flex justify-start pt-4 border-t">
                <Button variant="ghost" onClick={handleBack}>
                  Voltar
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Generated Link */}
          {step === "link" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Método:</span>
                  <span className={`font-medium ${paymentMethod === "pix" ? "text-success" : "text-primary"}`}>
                    {paymentMethod === "pix" ? "PIX" : "Cartão ou Boleto"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Link de Entrega</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedUrl}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title="Copiar"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpen}
                    title="Abrir"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={handleBack}>
                  Voltar
                </Button>
                <Button onClick={handleCopy}>
                  {copied ? "Copiado!" : "Copiar Link"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkGenerator;
