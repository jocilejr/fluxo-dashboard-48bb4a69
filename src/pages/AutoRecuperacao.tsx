import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, X, Circle, Zap, Clock, Radio, Save, CreditCard, ShoppingCart, FileText, Settings, CheckCheck, Camera, Smile, Mic, ArrowLeft, MoreVertical, Phone, Video, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InstanceSelectorModal } from "@/components/recovery/InstanceSelectorModal";
import { BoletoRecoveryRulesConfig } from "@/components/dashboard/BoletoRecoveryRulesConfig";
import { getGreeting } from "@/lib/greeting";
import { RecoveryLogsTab } from "@/components/dashboard/RecoveryLogsTab";

interface MessagingSettings {
  id?: string;
  server_url: string;
  api_key: string;
  webhook_url: string;
  is_active: boolean;
  boleto_recovery_enabled: boolean;
  pix_card_recovery_enabled: boolean;
  abandoned_recovery_enabled: boolean;
  delay_between_messages: number;
  daily_limit: number;
  cron_enabled: boolean;
  cron_interval_minutes: number;
  working_hours_enabled: boolean;
  working_hours_start: number;
  working_hours_end: number;
  boleto_instance_name: string | null;
  pix_card_instance_name: string | null;
  abandoned_instance_name: string | null;
  auto_pix_card_message: string;
  auto_abandoned_message: string;
  auto_boleto_message: string;
  boleto_send_hour: number;
  boleto_send_pdf: boolean;
}

const defaultSettings: MessagingSettings = {
  server_url: "",
  api_key: "",
  webhook_url: "",
  is_active: false,
  boleto_recovery_enabled: false,
  pix_card_recovery_enabled: false,
  abandoned_recovery_enabled: false,
  delay_between_messages: 5,
  daily_limit: 100,
  cron_enabled: false,
  cron_interval_minutes: 60,
  working_hours_enabled: false,
  working_hours_start: 8,
  working_hours_end: 20,
  boleto_instance_name: null,
  pix_card_instance_name: null,
  abandoned_instance_name: null,
  auto_pix_card_message: "Olá {primeiro_nome}! Notamos que seu pagamento de {valor} está pendente. Podemos ajudar?",
  auto_abandoned_message: "Olá {primeiro_nome}! Vi que você demonstrou interesse em nossos produtos. Posso ajudar você a finalizar sua compra?",
  auto_boleto_message: "{saudação}, {primeiro_nome}! Seu boleto de {valor} referente a {produto} vence em {vencimento}. Não deixe passar!",
  boleto_send_hour: 9,
  boleto_send_pdf: true,
};

const VARIABLES_INFO = [
  { var: "{saudação}" },
  { var: "{nome}" },
  { var: "{primeiro_nome}" },
  { var: "{valor}" },
  { var: "{produto}" },
];

const EXAMPLE_VALUES: Record<string, string> = {
  "{saudação}": getGreeting(),
  "{nome}": "João Silva",
  "{primeiro_nome}": "João",
  "{valor}": "R$ 97,00",
  "{produto}": "Curso Digital",
  "{vencimento}": "05/04/2026",
};

// WhatsApp panel preview — fills the column, no phone frame
const WhatsAppPanelPreview = ({ message }: { message: string }) => {
  const rendered = useMemo(() => {
    let text = message || "";
    Object.entries(EXAMPLE_VALUES).forEach(([key, value]) => {
      text = text.split(key).join(value);
    });
    return text;
  }, [message]);

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  if (!message.trim()) {
    return (
      <div className="flex flex-col h-full rounded-lg overflow-hidden border border-border/30" style={{ backgroundColor: "#0b141a", minHeight: 340 }}>
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: "#1f2c33" }}>
          <ArrowLeft className="h-4 w-4" style={{ color: "#aebac1" }} />
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#6b7b8d", color: "#e9edef" }}>J</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "#e9edef" }}>João Silva</p>
            <p className="text-[10px]" style={{ color: "#8696a0" }}>online</p>
          </div>
          <div className="flex items-center gap-3">
            <Video className="h-4 w-4" style={{ color: "#aebac1" }} />
            <Phone className="h-4 w-4" style={{ color: "#aebac1" }} />
            <MoreVertical className="h-4 w-4" style={{ color: "#aebac1" }} />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-xs text-center" style={{ color: "#8696a0" }}>Componha uma mensagem para ver o preview</p>
        </div>
        <div className="flex items-center gap-2 px-2 py-2" style={{ backgroundColor: "#1f2c33" }}>
          <Smile className="h-5 w-5 shrink-0" style={{ color: "#8696a0" }} />
          <div className="flex-1 rounded-full px-3 py-1.5" style={{ backgroundColor: "#2a3942" }}>
            <span className="text-xs" style={{ color: "#8696a0" }}>Mensagem</span>
          </div>
          <Camera className="h-5 w-5 shrink-0" style={{ color: "#8696a0" }} />
          <Mic className="h-5 w-5 shrink-0" style={{ color: "#8696a0" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border border-border/30" style={{ backgroundColor: "#0b141a", minHeight: 340 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: "#1f2c33" }}>
        <ArrowLeft className="h-4 w-4" style={{ color: "#aebac1" }} />
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#6b7b8d", color: "#e9edef" }}>J</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: "#e9edef" }}>João Silva</p>
          <p className="text-[10px]" style={{ color: "#8696a0" }}>online</p>
        </div>
        <div className="flex items-center gap-3">
          <Video className="h-4 w-4" style={{ color: "#aebac1" }} />
          <Phone className="h-4 w-4" style={{ color: "#aebac1" }} />
          <MoreVertical className="h-4 w-4" style={{ color: "#aebac1" }} />
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 px-3 py-3 flex flex-col justify-end" style={{ backgroundColor: "#0b141a" }}>
        {/* Date chip */}
        <div className="flex justify-center mb-3">
          <span className="text-[10px] px-3 py-0.5 rounded-md" style={{ backgroundColor: "#182229", color: "#8696a0" }}>HOJE</span>
        </div>

        {/* Incoming message */}
        <div className="max-w-[85%] mr-auto mb-1.5">
          <div className="rounded-lg rounded-tl-none px-2.5 py-1.5" style={{ backgroundColor: "#202c33" }}>
            <p className="text-xs leading-relaxed" style={{ color: "#e9edef" }}>Olá, gostaria de mais informações</p>
            <div className="flex justify-end mt-0.5">
              <span className="text-[9px]" style={{ color: "#8696a0" }}>
                {`${(now.getHours() - 1 + 24) % 24}`.padStart(2, "0")}:{now.getMinutes().toString().padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* Sent message */}
        <div className="max-w-[85%] ml-auto">
          <div className="rounded-lg rounded-tr-none px-2.5 py-1.5" style={{ backgroundColor: "#005c4b" }}>
            <p className="text-xs whitespace-pre-wrap leading-relaxed break-words" style={{ color: "#e9edef" }}>{rendered}</p>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.5)" }}>{time}</span>
              <CheckCheck className="h-3 w-3" style={{ color: "#53bdeb" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-2 py-2" style={{ backgroundColor: "#1f2c33" }}>
        <Smile className="h-5 w-5 shrink-0" style={{ color: "#8696a0" }} />
        <div className="flex-1 rounded-full px-3 py-1.5" style={{ backgroundColor: "#2a3942" }}>
          <span className="text-xs" style={{ color: "#8696a0" }}>Mensagem</span>
        </div>
        <Camera className="h-5 w-5 shrink-0" style={{ color: "#8696a0" }} />
        <Mic className="h-5 w-5 shrink-0" style={{ color: "#8696a0" }} />
      </div>
    </div>
  );
};

const RecoveryTabContent = ({
  type,
  title,
  description,
  badgeLabel,
  badgeIcon: BadgeIcon,
  enabled,
  onToggle,
  instanceName,
  message,
  onMessageChange,
  showBoletoRules,
  extraSettings,
  apiConfigured,
  onSelectInstance,
  onRemoveInstance,
  hideMessage,
  onSave,
  isSaving,
}: {
  type: 'boleto' | 'pix_card' | 'abandoned';
  title: string;
  description: string;
  badgeLabel: string;
  badgeIcon: typeof Radio;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  instanceName: string | null;
  message: string;
  onMessageChange: (v: string) => void;
  showBoletoRules?: boolean;
  extraSettings?: React.ReactNode;
  apiConfigured: boolean;
  onSelectInstance: (type: 'boleto' | 'pix_card' | 'abandoned') => void;
  onRemoveInstance: (type: 'boleto' | 'pix_card' | 'abandoned') => void;
  hideMessage?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
}) => (
  <div className="space-y-4">
    <Card className="border-border/40">
      {/* Compact header: switch + instance + badge */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={onToggle} />
          <div>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="text-[10px] text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {instanceName ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30">
              <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />
              <span className="text-[10px] font-medium truncate max-w-[100px]">{instanceName}</span>
              <button onClick={() => onRemoveInstance(type)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => apiConfigured && onSelectInstance(type)}
              disabled={!apiConfigured}
              className="text-[10px] text-primary hover:underline disabled:text-muted-foreground disabled:no-underline px-2 py-1 rounded border border-dashed border-border/50"
            >
              {apiConfigured ? "Selecionar instância" : "Configure a API"}
            </button>
          )}
          <Badge variant="outline" className="text-[10px] h-5 gap-1 shrink-0">
            <BadgeIcon className="h-2.5 w-2.5" />
            {badgeLabel}
          </Badge>
        </div>
      </div>

      {/* Two-column: editor + preview (hidden for boleto) */}
      {!hideMessage && (
        <CardContent className="p-4">
          <div className="grid md:grid-cols-[1fr,320px] gap-4">
            {/* Left: editor */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Mensagem automática</Label>
                <Textarea
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder="Digite a mensagem..."
                  className="min-h-[200px] text-sm bg-secondary/20 border-border/30 resize-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Variáveis disponíveis</Label>
                <div className="flex flex-wrap gap-1">
                  {VARIABLES_INFO.map((v) => (
                    <button
                      key={v.var}
                      type="button"
                      onClick={() => onMessageChange(message + v.var)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>
              {/* Save button below editor */}
              {onSave && (
                <div className="pt-2">
                  <Button onClick={onSave} disabled={isSaving} size="sm" variant="default">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Salvar
                  </Button>
                </div>
              )}
            </div>

            {/* Right: WhatsApp panel preview */}
            <div className="flex flex-col">
              <Label className="text-xs font-medium text-muted-foreground mb-1.5">Preview</Label>
              <WhatsAppPanelPreview message={message} />
            </div>
          </div>
        </CardContent>
      )}
    </Card>

    {extraSettings}
    {showBoletoRules && <BoletoRecoveryRulesConfig />}
  </div>
);

const AutoRecuperacao = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<MessagingSettings>(defaultSettings);
  const [instanceModal, setInstanceModal] = useState<{ open: boolean; type: 'boleto' | 'pix_card' | 'abandoned' } | null>(null);

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["messaging-api-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messaging_api_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as MessagingSettings | null;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["messaging-stats"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("message_log")
        .select("status, message_type")
        .gte("created_at", todayStart.toISOString());
      if (error) return { sent: 0, failed: 0, boleto: 0, pix_card: 0, abandoned: 0 };
      return {
        sent: data?.filter((l) => l.status === "sent").length || 0,
        failed: data?.filter((l) => l.status === "failed").length || 0,
        boleto: data?.filter((l) => l.message_type === "boleto").length || 0,
        pix_card: data?.filter((l) => l.message_type === "pix_card").length || 0,
        abandoned: data?.filter((l) => l.message_type === "abandoned").length || 0,
      };
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (savedSettings) setSettings({ ...defaultSettings, ...savedSettings });
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: MessagingSettings) => {
      const payload = {
        server_url: newSettings.server_url,
        api_key: newSettings.api_key,
        webhook_url: newSettings.webhook_url,
        is_active: newSettings.is_active,
        boleto_recovery_enabled: newSettings.boleto_recovery_enabled,
        pix_card_recovery_enabled: newSettings.pix_card_recovery_enabled,
        abandoned_recovery_enabled: newSettings.abandoned_recovery_enabled,
        delay_between_messages: newSettings.delay_between_messages,
        daily_limit: newSettings.daily_limit,
        cron_enabled: newSettings.cron_enabled,
        cron_interval_minutes: newSettings.cron_interval_minutes,
        working_hours_enabled: newSettings.working_hours_enabled,
        working_hours_start: newSettings.working_hours_start,
        working_hours_end: newSettings.working_hours_end,
        boleto_instance_name: newSettings.boleto_instance_name,
        pix_card_instance_name: newSettings.pix_card_instance_name,
        abandoned_instance_name: newSettings.abandoned_instance_name,
        auto_pix_card_message: newSettings.auto_pix_card_message,
        auto_abandoned_message: newSettings.auto_abandoned_message,
        auto_boleto_message: newSettings.auto_boleto_message,
        boleto_send_hour: newSettings.boleto_send_hour,
        boleto_send_pdf: newSettings.boleto_send_pdf,
      };

      if (newSettings.id) {
        const { error } = await supabase
          .from("messaging_api_settings")
          .update(payload)
          .eq("id", newSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("messaging_api_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging-api-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  const getInstanceKey = (type: 'boleto' | 'pix_card' | 'abandoned'): keyof MessagingSettings => {
    const map = { boleto: 'boleto_instance_name', pix_card: 'pix_card_instance_name', abandoned: 'abandoned_instance_name' } as const;
    return map[type];
  };

  const handleInstanceSelect = (type: 'boleto' | 'pix_card' | 'abandoned', instanceName: string) => {
    const key = getInstanceKey(type);
    const updated = { ...settings, [key]: instanceName };
    setSettings(updated);
    saveMutation.mutate(updated);
  };

  const removeInstance = (type: 'boleto' | 'pix_card' | 'abandoned') => {
    const key = getInstanceKey(type);
    const updated = { ...settings, [key]: null };
    setSettings(updated);
    saveMutation.mutate(updated);
  };

  const apiConfigured = !!settings.server_url && !!settings.api_key;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Recuperação Automática</h1>
            <p className="text-xs text-muted-foreground">Mensagens automáticas de recuperação de vendas</p>
          </div>
        </div>
      </div>

      {!apiConfigured && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          ⚠️ Configure a API de mensagens em <strong>Configurações → API Mensagens</strong> antes de usar.
        </div>
      )}

      {/* Stats — subtle inline */}
      {stats && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Hoje:</span>
          <span className="text-foreground font-medium">{stats.sent}</span> enviadas
          <span className="text-muted-foreground">·</span>
          <span className="text-destructive font-medium">{stats.failed}</span> falhas
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground font-medium">{stats.boleto}</span> boleto
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground font-medium">{stats.pix_card}</span> pix
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground font-medium">{stats.abandoned}</span> abandono
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pix_card" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pix_card" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">PIX / Cartão</span>
            <span className="sm:hidden">PIX</span>
          </TabsTrigger>
          <TabsTrigger value="abandoned" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Abandonos</span>
            <span className="sm:hidden">Aband.</span>
          </TabsTrigger>
          <TabsTrigger value="boleto" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Boleto
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
            <span className="sm:hidden">⚙</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pix_card">
          <RecoveryTabContent
            type="pix_card"
            title="PIX / Cartão"
            description="Dispara ao receber transação PIX/Cartão pendente via webhook."
            badgeLabel="Tempo Real"
            badgeIcon={Radio}
            enabled={settings.pix_card_recovery_enabled}
            onToggle={(v) => setSettings({ ...settings, pix_card_recovery_enabled: v })}
            instanceName={settings.pix_card_instance_name}
            message={settings.auto_pix_card_message}
            onMessageChange={(v) => setSettings({ ...settings, auto_pix_card_message: v })}
            apiConfigured={apiConfigured}
            onSelectInstance={(t) => setInstanceModal({ open: true, type: t })}
            onRemoveInstance={removeInstance}
            onSave={() => saveMutation.mutate(settings)}
            isSaving={saveMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="abandoned">
          <RecoveryTabContent
            type="abandoned"
            title="Abandonos"
            description="Dispara ao receber evento de abandono via webhook."
            badgeLabel="Tempo Real"
            badgeIcon={Radio}
            enabled={settings.abandoned_recovery_enabled}
            onToggle={(v) => setSettings({ ...settings, abandoned_recovery_enabled: v })}
            instanceName={settings.abandoned_instance_name}
            message={settings.auto_abandoned_message}
            onMessageChange={(v) => setSettings({ ...settings, auto_abandoned_message: v })}
            apiConfigured={apiConfigured}
            onSelectInstance={(t) => setInstanceModal({ open: true, type: t })}
            onRemoveInstance={removeInstance}
            onSave={() => saveMutation.mutate(settings)}
            isSaving={saveMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="boleto">
          <RecoveryTabContent
            type="boleto"
            title="Boleto"
            description={`Executa diariamente às ${settings.boleto_send_hour}h, seguindo a régua de cobrança.`}
            badgeLabel={`Diário ${settings.boleto_send_hour}h`}
            badgeIcon={Clock}
            enabled={settings.boleto_recovery_enabled}
            onToggle={(v) => setSettings({ ...settings, boleto_recovery_enabled: v })}
            instanceName={settings.boleto_instance_name}
            message={settings.auto_boleto_message}
            onMessageChange={(v) => setSettings({ ...settings, auto_boleto_message: v })}
            showBoletoRules
            hideMessage
            apiConfigured={apiConfigured}
            onSelectInstance={(t) => setInstanceModal({ open: true, type: t })}
            onRemoveInstance={removeInstance}
            onSave={() => saveMutation.mutate(settings)}
            isSaving={saveMutation.isPending}
            extraSettings={
              <div className="space-y-3">
                <Card className="border-border/40">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm font-medium">Enviar PDF do boleto</Label>
                        <p className="text-[10px] text-muted-foreground">Envia o arquivo PDF do boleto junto com a mensagem (quando disponível)</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.boleto_send_pdf}
                      onCheckedChange={(checked) => setSettings({ ...settings, boleto_send_pdf: checked })}
                    />
                  </div>
                </Card>
                <Card className="border-border/40">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm font-medium">Horário de envio</Label>
                        <p className="text-[10px] text-muted-foreground">Define a hora do disparo diário automático</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={settings.boleto_send_hour}
                        onChange={(e) => setSettings({ ...settings, boleto_send_hour: Math.min(23, Math.max(0, Number(e.target.value))) })}
                        className="bg-secondary/30 border-border/30 h-9 text-sm w-20 text-center"
                      />
                      <span className="text-sm text-muted-foreground">h</span>
                    </div>
                  </div>
                </Card>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="logs">
          <RecoveryLogsTab />
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações Gerais
              </CardTitle>
              <CardDescription className="text-xs">
                Limites de envio, delay e horário de funcionamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Limite diário</Label>
                  <Input
                    type="number"
                    value={settings.daily_limit}
                    onChange={(e) => setSettings({ ...settings, daily_limit: Number(e.target.value) })}
                    className="bg-secondary/30 border-border/30 h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Máximo de mensagens por dia</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delay entre mensagens (s)</Label>
                  <Input
                    type="number"
                    value={settings.delay_between_messages}
                    onChange={(e) => setSettings({ ...settings, delay_between_messages: Number(e.target.value) })}
                    className="bg-secondary/30 border-border/30 h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Intervalo entre cada envio</p>
                </div>
              </div>

              <div className="border-t border-border/30 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Horário comercial</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Enviar apenas dentro do horário</p>
                  </div>
                  <Switch
                    checked={settings.working_hours_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, working_hours_enabled: checked })}
                  />
                </div>

                {settings.working_hours_enabled && (
                  <div className="flex items-center gap-3 pl-1">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Início</Label>
                      <Input
                        type="number" min={0} max={23}
                        value={settings.working_hours_start}
                        onChange={(e) => setSettings({ ...settings, working_hours_start: Number(e.target.value) })}
                        className="bg-secondary/30 border-border/30 h-9 text-sm w-20"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground mt-5">às</span>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Fim</Label>
                      <Input
                        type="number" min={0} max={23}
                        value={settings.working_hours_end}
                        onChange={(e) => setSettings({ ...settings, working_hours_end: Number(e.target.value) })}
                        className="bg-secondary/30 border-border/30 h-9 text-sm w-20"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instance Selector Modal */}
      {instanceModal && (
        <InstanceSelectorModal
          open={instanceModal.open}
          onOpenChange={(open) => { if (!open) setInstanceModal(null); }}
          serverUrl={settings.server_url}
          apiKey={settings.api_key}
          currentInstance={settings[getInstanceKey(instanceModal.type)] as string | null}
          onSelect={(name) => handleInstanceSelect(instanceModal.type, name)}
          title={`Selecionar instância — ${instanceModal.type === 'boleto' ? 'Boleto' : instanceModal.type === 'pix_card' ? 'PIX/Cartão' : 'Abandonos'}`}
        />
      )}
    </div>
  );
};

export default AutoRecuperacao;
