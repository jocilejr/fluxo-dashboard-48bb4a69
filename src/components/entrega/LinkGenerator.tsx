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
import { Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addActivityLog } from "@/components/settings/ActivityLogs";

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

const LinkGenerator = ({ open, onClose, product }: LinkGeneratorProps) => {
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [linkMessageTemplate, setLinkMessageTemplate] = useState<string>("{link}");
  const [step, setStep] = useState<"phone" | "link">("phone");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolvedPhone, setResolvedPhone] = useState("");

  useEffect(() => {
    if (open) {
      loadCustomDomain();
      setStep("phone");
    }
  }, [open]);

  const loadCustomDomain = async () => {
    try {
      const { data } = await supabase
        .from("delivery_settings")
        .select("custom_domain, link_message_template")
        .limit(1)
        .single();

      if (data?.custom_domain) setCustomDomain(data.custom_domain);
      if (data?.link_message_template) setLinkMessageTemplate(data.link_message_template);
    } catch (error) {
      console.error("Erro ao carregar domínio:", error);
    }
  };

  const cleanPhone = phone.replace(/\D/g, "");
  const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const baseUrl = customDomain ? `https://${customDomain}` : window.location.origin;
  const linkPhone = resolvedPhone || normalizedPhone;
  const generatedUrl = cleanPhone ? `${baseUrl}/membros/${linkPhone}` : "";

  const handleGenerate = async () => {
    if (!cleanPhone) {
      toast.error("Informe o telefone do cliente");
      return;
    }
    if (isProcessing || !product) return;
    setIsProcessing(true);

    try {
      // 1. Check if access already exists by last 8 digits
      const last8 = normalizedPhone.slice(-8);
      const { data: existingAccesses } = await supabase
        .from("member_products")
        .select("id, normalized_phone")
        .eq("product_id", product.id);

      const match = existingAccesses?.find(
        (mp) => mp.normalized_phone.slice(-8) === last8
      );

      let phoneForLink = normalizedPhone;

      if (match) {
        // Already has access — reuse existing phone for the link
        phoneForLink = match.normalized_phone;
        // Ensure it's active
        await supabase
          .from("member_products")
          .update({ is_active: true, granted_at: new Date().toISOString() })
          .eq("id", match.id);
      } else {
        // No existing access — insert new
        const { error: memberError } = await supabase
          .from("member_products")
          .insert({
            normalized_phone: normalizedPhone,
            product_id: product.id,
            is_active: true,
          });

        if (memberError && !memberError.message.includes("duplicate")) {
          throw memberError;
        }
      }

      // 2. Register the link generation for tracking
      await supabase.from("delivery_link_generations").insert({
        product_id: product.id,
        phone: phone,
        normalized_phone: normalizedPhone,
        payment_method: "pix",
      });

      toast.success("Acesso liberado e link gerado!");
      addActivityLog({
        type: "success",
        category: "Entrega",
        message: `Acesso liberado: ${product.name}`,
        details: `Telefone: ${phone}`,
      });
      setResolvedPhone(phoneForLink);
      setStep("link");
    } catch (error) {
      console.error("Erro ao gerar acesso:", error);
      toast.error("Erro ao liberar acesso");
      addActivityLog({
        type: "error",
        category: "Entrega",
        message: `Erro ao liberar acesso: ${product?.name}`,
        details: `Telefone: ${phone}, Erro: ${error}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      const messageWithLink = linkMessageTemplate.replace("{link}", generatedUrl);
      await navigator.clipboard.writeText(messageWithLink);
      setCopied(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleOpen = () => {
    if (generatedUrl) window.open(generatedUrl, "_blank");
  };

  const handleClose = () => {
    setPhone("");
    setCopied(false);
    setResolvedPhone("");
    setStep("phone");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "phone" ? "Liberar Acesso e Gerar Link" : "Link Gerado"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === "phone" && (
            <>
              <div className="space-y-2">
                <Label>Produto</Label>
                <p className="text-sm font-medium">{product?.name}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp do Cliente *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="5511999999999"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  O acesso será liberado na área de membros para este número
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleGenerate} disabled={!cleanPhone || isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Liberando...
                    </>
                  ) : (
                    "Liberar Acesso"
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "link" && (
            <>
              <div className="rounded-lg bg-success/10 border border-success/20 p-3">
                <p className="text-sm text-success font-medium flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Acesso liberado com sucesso!
                </p>
              </div>

              <div className="space-y-2">
                <Label>Link da Área de Membros</Label>
                <div className="flex gap-2">
                  <Input value={generatedUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={handleCopy} title="Copiar">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleOpen} title="Abrir">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={handleClose}>
                  Fechar
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
