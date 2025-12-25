import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ManualBoletoFormData {
  nome: string;
  telefone: string;
  valor: string;
  cpf: string;
}

const GerarBoleto = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<ManualBoletoFormData>({
    nome: "",
    telefone: "",
    valor: "",
    cpf: "",
  });

  useEffect(() => {
    fetchWebhookUrl();
    
    // Pre-fill form from query params
    const nome = searchParams.get("nome");
    const telefone = searchParams.get("telefone");
    const valor = searchParams.get("valor");
    const cpf = searchParams.get("cpf");
    
    if (nome || telefone || valor || cpf) {
      setFormData({
        nome: nome || "",
        telefone: telefone || "",
        valor: valor || "",
        cpf: cpf ? cpf.replace(/\D/g, "").slice(0, 11) : "",
      });
    }
  }, [searchParams]);

  const fetchWebhookUrl = async () => {
    const { data, error } = await supabase
      .from("manual_boleto_settings")
      .select("webhook_url")
      .maybeSingle();

    if (error) {
      console.error("Error fetching webhook URL:", error);
      return;
    }
    setWebhookUrl(data?.webhook_url || null);
  };

  const handleChange = (field: keyof ManualBoletoFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits;
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits;
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!formData.telefone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }
    if (!formData.valor.trim() || isNaN(parseFloat(formData.valor))) {
      toast.error("Valor inválido");
      return;
    }
    if (!formData.cpf.trim() || formData.cpf.length !== 11) {
      toast.error("CPF inválido (deve ter 11 dígitos)");
      return;
    }
    if (!webhookUrl) {
      toast.error("Webhook não configurado. Configure nas configurações.");
      return;
    }

    setIsLoading(true);
    try {
      const normalizedPhone = formatPhone(formData.telefone);
      const cpfFormatted = formatCPF(formData.cpf);
      
      const payload = {
        nome: formData.nome.trim(),
        telefone: normalizedPhone,
        Valor: parseFloat(formData.valor),
        CPF: cpfFormatted,
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update customer document (CPF) if we have a phone number
      if (normalizedPhone && cpfFormatted) {
        const { error: updateError } = await supabase
          .from("customers")
          .update({ 
            document: cpfFormatted,
            name: formData.nome.trim() || undefined,
          })
          .or(`normalized_phone.eq.${normalizedPhone},normalized_phone.like.%${normalizedPhone.slice(-10)}%`);
        
        if (updateError) {
          console.error("Error updating customer document:", updateError);
        }
      }

      toast.success("Boleto gerado com sucesso!");
      setFormData({ nome: "", telefone: "", valor: "", cpf: "" });
    } catch (error) {
      console.error("Error generating boleto:", error);
      toast.error("Erro ao gerar boleto. Verifique o webhook.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Gerar Boleto</h1>
      
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Boleto Manualmente
          </CardTitle>
          <CardDescription>
            Preencha os dados do cliente para gerar um novo boleto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!webhookUrl && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
              Webhook não configurado. Configure nas configurações para gerar boletos.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              placeholder="Nome completo do cliente"
              value={formData.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone *</Label>
            <Input
              id="telefone"
              placeholder="+5521968643431"
              value={formData.telefone}
              onChange={(e) => handleChange("telefone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$) *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              placeholder="50.00"
              value={formData.valor}
              onChange={(e) => handleChange("valor", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              placeholder="12345678901"
              maxLength={11}
              value={formData.cpf}
              onChange={(e) => handleChange("cpf", formatCPF(e.target.value))}
            />
          </div>

          <Button
            className="w-full mt-4"
            onClick={handleSubmit}
            disabled={isLoading || !webhookUrl}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Gerando...
              </>
            ) : (
              "Gerar Boleto"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default GerarBoleto;
