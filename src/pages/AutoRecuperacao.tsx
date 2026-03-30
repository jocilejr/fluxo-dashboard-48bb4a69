import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Smartphone, X, Circle, Zap, Clock, Radio, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InstanceSelectorModal } from "@/components/recovery/InstanceSelectorModal";
import { BoletoRecoveryRulesConfig } from "@/components/dashboard/BoletoRecoveryRulesConfig";

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
  { var: "{saudação}", desc: "Bom dia/tarde/noite" },
  { var: "{nome}", desc: "Nome completo" },
  { var: "{primeiro_nome}", desc: "Primeiro nome" },
  { var: "{valor}", desc: "Valor" },
  { var: "{produto}", desc: "Nome do produto" },
];

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

  const VariablesHint = ({ extra }: { extra?: string[] }) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {VARIABLES_INFO.map((v) => (
        <span key={v.var} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
          {v.var}
        </span>
      ))}
      {extra?.map((v) => (
        <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
          {v}
        </span>
      ))}
    </div>
  );

  const InstanceSelector = ({ 
    type, 
    instanceName,
  }: { 
    type: 'boleto' | 'pix_card' | 'abandoned'; 
    instanceName: string | null;
  }) => (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Instância WhatsApp</Label>
      {instanceName ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{instanceName}</p>
            <p className="text-[10px] text-emerald-400">Conectada</p>
          </div>
          <button
            onClick={() => removeInstance(type)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs"
          onClick={() => setInstanceModal({ open: true, type })}
          disabled={!apiConfigured}
        >
          <Smartphone className="h-3.5 w-3.5 mr-1.5" />
          {apiConfigured ? "Selecionar instância" : "Configure a API primeiro"}
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Recuperação Automática</h1>
          <p className="text-sm text-muted-foreground">Mensagens exclusivas da automação — independentes da recuperação manual</p>
        </div>
      </div>

      {!apiConfigured && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          ⚠️ Configure a API de mensagens em <strong>Configurações → API Mensagens</strong> antes de usar a recuperação automática.
        </div>
      )}

      {/* ===== PIX/CARTÃO ===== */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">PIX / Cartão</CardTitle>
              <Badge variant="outline" className="text-[10px] h-5 gap-1">
                <Radio className="h-2.5 w-2.5" />
                Tempo Real
              </Badge>
            </div>
            <Switch
              checked={settings.pix_card_recovery_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, pix_card_recovery_enabled: checked })}
            />
          </div>
          <CardDescription className="text-xs">
            Dispara automaticamente quando chega transação PIX/Cartão pendente via webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InstanceSelector type="pix_card" instanceName={settings.pix_card_instance_name} />
          <div className="space-y-2">
            <Label className="text-xs">Mensagem automática (exclusiva desta automação)</Label>
            <Textarea
              value={settings.auto_pix_card_message}
              onChange={(e) => setSettings({ ...settings, auto_pix_card_message: e.target.value })}
              placeholder="Olá {nome}! Seu pagamento de {valor} está pendente..."
              className="min-h-[80px] text-sm"
            />
            <VariablesHint />
          </div>
        </CardContent>
      </Card>

      {/* ===== ABANDONOS ===== */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Abandonos</CardTitle>
              <Badge variant="outline" className="text-[10px] h-5 gap-1">
                <Radio className="h-2.5 w-2.5" />
                Tempo Real
              </Badge>
            </div>
            <Switch
              checked={settings.abandoned_recovery_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, abandoned_recovery_enabled: checked })}
            />
          </div>
          <CardDescription className="text-xs">
            Dispara automaticamente quando um evento de abandono é recebido via webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InstanceSelector type="abandoned" instanceName={settings.abandoned_instance_name} />
          <div className="space-y-2">
            <Label className="text-xs">Mensagem automática (exclusiva desta automação)</Label>
            <Textarea
              value={settings.auto_abandoned_message}
              onChange={(e) => setSettings({ ...settings, auto_abandoned_message: e.target.value })}
              placeholder="Olá {primeiro_nome}! Vi que você demonstrou interesse..."
              className="min-h-[80px] text-sm"
            />
            <VariablesHint />
          </div>
        </CardContent>
      </Card>

      {/* ===== BOLETO ===== */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Boleto</CardTitle>
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Clock className="h-2.5 w-2.5" />
                Diário 9h
              </Badge>
            </div>
            <Switch
              checked={settings.boleto_recovery_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, boleto_recovery_enabled: checked })}
            />
          </div>
          <CardDescription className="text-xs">
            Executa automaticamente todos os dias às 9h, seguindo a régua de cobrança abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InstanceSelector type="boleto" instanceName={settings.boleto_instance_name} />
          <BoletoRecoveryRulesConfig />
        </CardContent>
      </Card>

      {/* Limits & Working Hours */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Limites e Horário</CardTitle>
          <CardDescription className="text-xs">Configure limites diários e horário de funcionamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Limite diário</Label>
              <Input
                type="number"
                value={settings.daily_limit}
                onChange={(e) => setSettings({ ...settings, daily_limit: Number(e.target.value) })}
                className="bg-secondary/30 border-border/30 h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Delay entre msgs (seg)</Label>
              <Input
                type="number"
                value={settings.delay_between_messages}
                onChange={(e) => setSettings({ ...settings, delay_between_messages: Number(e.target.value) })}
                className="bg-secondary/30 border-border/30 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch
                checked={settings.working_hours_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, working_hours_enabled: checked })}
              />
              <Label className="text-xs">Horário comercial ({settings.working_hours_start}h - {settings.working_hours_end}h)</Label>
            </div>
          </div>

          {settings.working_hours_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Início (hora)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.working_hours_start}
                  onChange={(e) => setSettings({ ...settings, working_hours_start: Number(e.target.value) })}
                  className="bg-secondary/30 border-border/30 h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Fim (hora)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.working_hours_end}
                  onChange={(e) => setSettings({ ...settings, working_hours_end: Number(e.target.value) })}
                  className="bg-secondary/30 border-border/30 h-9 text-sm"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <Card className="bg-card/60 border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estatísticas de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              <div className="text-center p-3 rounded-lg bg-secondary/10">
                <p className="text-xl font-semibold text-foreground">{stats.sent}</p>
                <p className="text-[10px] text-muted-foreground">Enviadas</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/10">
                <p className="text-xl font-semibold text-destructive">{stats.failed}</p>
                <p className="text-[10px] text-muted-foreground">Falharam</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/10">
                <p className="text-xl font-semibold text-foreground">{stats.boleto}</p>
                <p className="text-[10px] text-muted-foreground">Boleto</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/10">
                <p className="text-xl font-semibold text-foreground">{stats.pix_card}</p>
                <p className="text-[10px] text-muted-foreground">PIX/Cartão</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/10">
                <p className="text-xl font-semibold text-foreground">{stats.abandoned}</p>
                <p className="text-[10px] text-muted-foreground">Abandonos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Trigger & Save */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" />
            Execução Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => runAutoRecovery()} disabled={!apiConfigured}>
              <Send className="h-3.5 w-3.5 mr-2" />
              Executar Todas
            </Button>
            <Button size="sm" variant="outline" onClick={() => runAutoRecovery('boleto')} disabled={!apiConfigured}>
              Boleto
            </Button>
            <Button size="sm" variant="outline" onClick={() => runAutoRecovery('pix_card')} disabled={!apiConfigured}>
              PIX/Cartão
            </Button>
            <Button size="sm" variant="outline" onClick={() => runAutoRecovery('abandoned')} disabled={!apiConfigured}>
              Abandonos
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              Salvar Todas as Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instance Selector Modal */}
      {instanceModal && (
        <InstanceSelectorModal
          open={instanceModal.open}
          onOpenChange={(open) => {
            if (!open) setInstanceModal(null);
          }}
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
