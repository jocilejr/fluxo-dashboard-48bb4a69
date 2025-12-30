import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Save, Loader2, AlertCircle, CheckCircle2, MessageSquare, Link } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DomainSettings = () => {
  const [customDomain, setCustomDomain] = useState("");
  const [globalRedirectUrl, setGlobalRedirectUrl] = useState("");
  const [linkMessageTemplate, setLinkMessageTemplate] = useState("Muito obrigada pela contribuição meu bem, vou deixar aqui o seu link de acesso 👇\n\n{link}");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setCustomDomain(data.custom_domain || "");
        setGlobalRedirectUrl((data as any).global_redirect_url || "");
        setLinkMessageTemplate(data.link_message_template || "Muito obrigada pela contribuição meu bem, vou deixar aqui o seu link de acesso 👇\n\n{link}");
        setSettingsId(data.id);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Clean the domain - remove trailing slashes and protocol
      let cleanDomain = customDomain.trim();
      cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
      cleanDomain = cleanDomain.replace(/\/+$/, "");

      if (settingsId) {
        const { error } = await supabase
          .from("delivery_settings")
          .update({ 
            custom_domain: cleanDomain || null, 
            global_redirect_url: globalRedirectUrl.trim() || null,
            link_message_template: linkMessageTemplate,
            updated_at: new Date().toISOString() 
          } as any)
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("delivery_settings")
          .insert({ 
            custom_domain: cleanDomain || null,
            global_redirect_url: globalRedirectUrl.trim() || null,
            link_message_template: linkMessageTemplate
          } as any)
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
      }

      setCustomDomain(cleanDomain);
      toast.success("Domínio salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* URL de Redirecionamento Global */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            URL de Redirecionamento Global
          </CardTitle>
          <CardDescription>
            Configure a URL padrão de redirecionamento para todos os produtos (produtos podem ter URL individual)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="globalRedirectUrl">URL de Redirecionamento *</Label>
            <Input
              id="globalRedirectUrl"
              value={globalRedirectUrl}
              onChange={(e) => setGlobalRedirectUrl(e.target.value)}
              placeholder="https://wa.me/5511999999999"
            />
            <p className="text-xs text-muted-foreground">
              URL para onde o usuário será redirecionado após o delay. Produtos sem URL própria usarão esta.
            </p>
          </div>

          {globalRedirectUrl && (
            <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <p className="text-xs text-success">
                <strong>Redirecionamento global ativo:</strong> {globalRedirectUrl}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mensagem do Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Mensagem do Link
          </CardTitle>
          <CardDescription>
            Configure a mensagem que será copiada junto com o link de entrega
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkMessage">Mensagem</Label>
            <Textarea
              id="linkMessage"
              value={linkMessageTemplate}
              onChange={(e) => setLinkMessageTemplate(e.target.value)}
              placeholder="Muito obrigada pela contribuição! Segue seu link: {link}"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{"{link}"}</code> para indicar onde o link será inserido
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Prévia da mensagem:</p>
            <p className="text-xs bg-background p-2 rounded whitespace-pre-wrap">
              {linkMessageTemplate.replace("{link}", "https://exemplo.com/e/produto?telefone=5511999999999")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Domínio Personalizado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domínio Personalizado
          </CardTitle>
          <CardDescription>
            Configure seu domínio personalizado para gerar URLs de entrega customizadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">URL do Domínio</Label>
            <Input
              id="domain"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="exemplo.com.br ou meusite.com"
            />
            <p className="text-xs text-muted-foreground">
              Informe apenas o domínio, sem https:// ou barras no final
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Exemplo de URL gerada:</p>
            <code className="text-xs bg-background p-2 rounded block">
              https://{customDomain || "seudominio.com"}/slug-do-produto?telefone=5511999999999
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações
          </>
        )}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como configurar seu domínio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                1
              </div>
              <div>
                <p className="font-medium text-sm">Acesse seu provedor de domínio</p>
                <p className="text-xs text-muted-foreground">
                  GoDaddy, Hostinger, Registro.br, Cloudflare, etc.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                2
              </div>
              <div>
                <p className="font-medium text-sm">Configure o DNS do seu domínio</p>
                <p className="text-xs text-muted-foreground">
                  Aponte seu domínio para o servidor onde sua aplicação está hospedada
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                3
              </div>
              <div>
                <p className="font-medium text-sm">Cole o domínio aqui</p>
                <p className="text-xs text-muted-foreground">
                  Após configurar o DNS, insira o domínio acima e salve
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-500">
              <strong>Importante:</strong> O domínio precisa estar apontando para este aplicativo para que as URLs funcionem corretamente.
            </p>
          </div>
        </CardContent>
      </Card>

      {customDomain && (
        <Card className="border-success/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="font-medium text-sm">Domínio configurado</p>
                <p className="text-xs text-muted-foreground">
                  Suas URLs de entrega usarão: <strong>https://{customDomain}</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DomainSettings;
