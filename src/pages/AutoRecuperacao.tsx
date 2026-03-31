import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Smartphone, X, Circle, Zap, Clock, Radio, Save, CreditCard, ShoppingCart, FileText, Settings, CheckCheck, Wifi, Battery, Signal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InstanceSelectorModal } from "@/components/recovery/InstanceSelectorModal";
import { BoletoRecoveryRulesConfig } from "@/components/dashboard/BoletoRecoveryRulesConfig";
import { getGreeting } from "@/lib/greeting";

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

// Mobile WhatsApp mockup preview
const WhatsAppPhoneMockup = ({ message }: { message: string }) => {
  const rendered = useMemo(() => {
    let text = message || "Sua mensagem aparecerá aqui...";
    Object.entries(EXAMPLE_VALUES).forEach(([key, value]) => {
      text = text.split(key).join(value);
    });
    return text;
  }, [message]);

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className="flex items-start justify-center py-4">
      {/* Phone frame */}
      <div className="w-[280px] rounded-[2rem] border-[3px] border-[#2a2a2e] bg-[#111b21] shadow-2xl shadow-black/40 overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-2 pb-1 bg-[#1f2c33]">
          <span className="text-[10px] font-medium text-[#aebac1]">{time}</span>
          <div className="flex items-center gap-1">
            <Signal className="h-2.5 w-2.5 text-[#aebac1]" />
            <Wifi className="h-2.5 w-2.5 text-[#aebac1]" />
            <Battery className="h-2.5 w-2.5 text-[#aebac1]" />
          </div>
        </div>

        {/* WhatsApp header */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-[#1f2c33] border-b border-[#2a3942]">
          <div className="text-[#aebac1] text-lg">←</div>
          <div className="w-8 h-8 rounded-full bg-[#6b7b8d] flex items-center justify-center text-[#e9edef] text-xs font-bold shrink-0">
            J
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#e9edef] truncate">João Silva</p>
            <p className="text-[10px] text-[#8696a0]">online</p>
          </div>
          <div className="flex items-center gap-3 text-[#aebac1]">
            <span className="text-sm">📹</span>
            <span className="text-sm">📞</span>
            <span className="text-sm">⋮</span>
          </div>
        </div>

        {/* Chat area */}
        <div
          className="min-h-[320px] px-3 py-4 flex flex-col justify-end"
          style={{
            backgroundColor: "#0b141a",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M20 18v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {/* Date chip */}
          <div className="flex justify-center mb-3">
            <span className="text-[10px] bg-[#182229] text-[#8696a0] px-3 py-1 rounded-md shadow-sm">
              HOJE
            </span>
          </div>

          {/* Incoming message (from contact) */}
          <div className="max-w-[82%] mr-auto mb-2">
            <div className="bg-[#202c33] rounded-lg rounded-tl-none px-2.5 py-1.5">
              <p className="text-[12px] text-[#e9edef] leading-relaxed">
                Olá, gostaria de mais informações
              </p>
              <div className="flex justify-end mt-0.5">
                <span className="text-[9px] text-[#8696a0]">
                  {`${(now.getHours() - 1 + 24) % 24}`.padStart(2, "0")}:{now.getMinutes().toString().padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>

          {/* Our auto message (sent) */}
          <div className="max-w-[82%] ml-auto">
            <div className="bg-[#005c4b] rounded-lg rounded-tr-none px-2.5 py-1.5 relative">
              <p className="text-[12px] text-[#e9edef] whitespace-pre-wrap leading-relaxed break-words">
                {rendered}
              </p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="text-[9px] text-[#ffffff80]">{time}</span>
                <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
              </div>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 px-2 py-2 bg-[#1f2c33] border-t border-[#2a3942]">
          <span className="text-[#8696a0] text-sm">😊</span>
          <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5">
            <span className="text-[11px] text-[#8696a0]">Mensagem</span>
          </div>
          <span className="text-[#8696a0] text-sm">🎤</span>
        </div>

        {/* Bottom nav bar */}
        <div className="h-1 bg-[#e9edef] rounded-full w-24 mx-auto my-1.5 opacity-30" />
      </div>
    </div>
  );
};

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

  const runAutoRecovery = async (type?: string) => {
    try {
      toast.info("Iniciando recuperação automática...");
      const { data, error } = await supabase.functions.invoke("auto-recovery", {
        body: { forceRun: true, type },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Recuperação concluída! ${data.totalSent} mensagens enviadas`);
        queryClient.invalidateQueries({ queryKey: ["messaging-stats"] });
      } else {
        toast.error(data?.error || "Erro na recuperação");
      }
    } catch {
      toast.error("Erro ao executar recuperação automática");
    }
  };

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

  const InstanceSelector = ({ type, instanceName }: { type: 'boleto' | 'pix_card' | 'abandoned'; instanceName: string | null }) => (
    <div className="flex items-center gap-2">
      <Label className="text-xs font-medium text-muted-foreground shrink-0">Instância:</Label>
      {instanceName ? (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30">
          <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium truncate max-w-[120px]">{instanceName}</span>
          <button onClick={() => removeInstance(type)} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => apiConfigured && setInstanceModal({ open: true, type })}
          disabled={!apiConfigured}
          className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {apiConfigured ? "Selecionar" : "Configure a API"}
        </button>
      )}
    </div>
  );

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
  }) => (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant={showBoletoRules ? "secondary" : "outline"} className="text-[10px] h-5 gap-1">
            <BadgeIcon className="h-2.5 w-2.5" />
            {badgeLabel}
          </Badge>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{description}</p>

      {/* Two-column layout: config + phone preview */}
      <div className="grid md:grid-cols-[1fr_auto] gap-6">
        {/* Left: Configuration card */}
        <Card className="bg-card/60 border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InstanceSelector type={type} instanceName={instanceName} />

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Mensagem automática</Label>
              <Textarea
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                placeholder="Digite a mensagem..."
                className="min-h-[140px] text-sm bg-secondary/20 border-border/30 resize-none"
              />
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

        </Card>

        {/* Right: Phone mockup preview */}
        <div className="flex flex-col items-center">
          <Label className="text-xs font-medium text-muted-foreground mb-1 text-center block">Preview da mensagem</Label>
          <WhatsAppPhoneMockup message={message} />
        </div>
      </div>

      {showBoletoRules && <BoletoRecoveryRulesConfig />}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Recuperação Automática</h1>
            <p className="text-sm text-muted-foreground">Mensagens exclusivas da automação — independentes da recuperação manual</p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} size="sm">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      {!apiConfigured && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          ⚠️ Configure a API de mensagens em <strong>Configurações → API Mensagens</strong> antes de usar.
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Enviadas", value: stats.sent, color: "text-foreground" },
            { label: "Falharam", value: stats.failed, color: "text-destructive" },
            { label: "Boleto", value: stats.boleto, color: "text-foreground" },
            { label: "PIX/Cartão", value: stats.pix_card, color: "text-foreground" },
            { label: "Abandonos", value: stats.abandoned, color: "text-foreground" },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 rounded-lg bg-secondary/10">
              <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Tabs: recovery types + settings */}
      <Tabs defaultValue="pix_card" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
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
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pix_card">
          <RecoveryTabContent
            type="pix_card"
            title="PIX / Cartão"
            description="Dispara automaticamente quando chega uma transação PIX/Cartão pendente via webhook."
            badgeLabel="Tempo Real"
            badgeIcon={Radio}
            enabled={settings.pix_card_recovery_enabled}
            onToggle={(v) => setSettings({ ...settings, pix_card_recovery_enabled: v })}
            instanceName={settings.pix_card_instance_name}
            message={settings.auto_pix_card_message}
            onMessageChange={(v) => setSettings({ ...settings, auto_pix_card_message: v })}
          />
        </TabsContent>

        <TabsContent value="abandoned">
          <RecoveryTabContent
            type="abandoned"
            title="Abandonos"
            description="Dispara automaticamente quando um evento de abandono é recebido via webhook."
            badgeLabel="Tempo Real"
            badgeIcon={Radio}
            enabled={settings.abandoned_recovery_enabled}
            onToggle={(v) => setSettings({ ...settings, abandoned_recovery_enabled: v })}
            instanceName={settings.abandoned_instance_name}
            message={settings.auto_abandoned_message}
            onMessageChange={(v) => setSettings({ ...settings, auto_abandoned_message: v })}
          />
        </TabsContent>

        <TabsContent value="boleto">
          <RecoveryTabContent
            type="boleto"
            title="Boleto"
            description="Executa automaticamente todos os dias às 9h, seguindo a régua de cobrança configurada abaixo."
            badgeLabel="Diário 9h"
            badgeIcon={Clock}
            enabled={settings.boleto_recovery_enabled}
            onToggle={(v) => setSettings({ ...settings, boleto_recovery_enabled: v })}
            instanceName={settings.boleto_instance_name}
            message={settings.auto_boleto_message}
            onMessageChange={(v) => setSettings({ ...settings, auto_boleto_message: v })}
            showBoletoRules
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="bg-card/60 border-border/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações Gerais
              </CardTitle>
              <CardDescription className="text-xs">
                Limites de envio, delay entre mensagens e horário de funcionamento da automação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Limite diário de mensagens</Label>
                  <Input
                    type="number"
                    value={settings.daily_limit}
                    onChange={(e) => setSettings({ ...settings, daily_limit: Number(e.target.value) })}
                    className="bg-secondary/30 border-border/30 h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Máximo de mensagens enviadas por dia em todas as automações</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delay entre mensagens (segundos)</Label>
                  <Input
                    type="number"
                    value={settings.delay_between_messages}
                    onChange={(e) => setSettings({ ...settings, delay_between_messages: Number(e.target.value) })}
                    className="bg-secondary/30 border-border/30 h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Intervalo mínimo entre cada mensagem enviada</p>
                </div>
              </div>

              <div className="border-t border-border/30 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Horário comercial</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Enviar mensagens apenas dentro do horário definido</p>
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
