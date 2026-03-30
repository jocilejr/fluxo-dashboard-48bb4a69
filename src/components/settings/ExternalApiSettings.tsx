import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wifi, WifiOff, Send, Settings2, RefreshCw, Users, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageLogs } from "./MessageLogs";

interface MessagingSettings {
  id?: string;
  server_url: string;
  api_key: string;
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
}

const defaultSettings: MessagingSettings = {
  server_url: "",
  api_key: "",
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
};

export function ExternalApiSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<MessagingSettings>(defaultSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");

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

  // Stats query
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
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: MessagingSettings) => {
      if (newSettings.id) {
        const { error } = await supabase
          .from("messaging_api_settings")
          .update({
            server_url: newSettings.server_url,
            api_key: newSettings.api_key,
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
          })
          .eq("id", newSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("messaging_api_settings")
          .insert({
            server_url: newSettings.server_url,
            api_key: newSettings.api_key,
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
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging-api-settings"] });
      queryClient.invalidateQueries({ queryKey: ["messaging-api-settings-header"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  const testConnection = async () => {
    if (!settings.server_url) {
      toast.error("Preencha a URL da API");
      return;
    }
    setIsTesting(true);
    setConnectionStatus("idle");
    try {
      const response = await fetch(`${settings.server_url.replace(/\/$/, '')}/api/platform/contacts?limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.api_key}`,
        },
      });
      if (response.ok) {
        setConnectionStatus("connected");
        toast.success("Conexão com API externa estabelecida!");
      } else {
        setConnectionStatus("error");
        toast.error("API externa não respondeu corretamente");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("Não foi possível conectar com a API externa");
    } finally {
      setIsTesting(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Settings */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuração da API Externa
          </CardTitle>
          <CardDescription className="text-xs">
            Configure a conexão com sua aplicação de envio de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">URL Base da API</Label>
              <Input
                placeholder="https://sua-api.com"
                value={settings.server_url}
                onChange={(e) => setSettings({ ...settings, server_url: e.target.value })}
                className="bg-secondary/30 border-border/30 h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">API Key / Token</Label>
              <Input
                type="password"
                placeholder="Bearer token de autenticação"
                value={settings.api_key}
                onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                className="bg-secondary/30 border-border/30 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.is_active}
                onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
              />
              <Label className="text-xs">API Ativa</Label>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : connectionStatus === "connected" ? (
                  <Wifi className="h-3.5 w-3.5 mr-2 text-success" />
                ) : connectionStatus === "error" ? (
                  <WifiOff className="h-3.5 w-3.5 mr-2 text-destructive" />
                ) : (
                  <Wifi className="h-3.5 w-3.5 mr-2" />
                )}
                Testar Conexão
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(settings)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : null}
                Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Settings */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" />
            Recuperação Automática
          </CardTitle>
          <CardDescription className="text-xs">
            Configure quais tipos de recuperação automática estão ativos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
              <div>
                <p className="text-xs font-medium">Boleto</p>
                <p className="text-[10px] text-muted-foreground">Recuperar boletos pendentes</p>
              </div>
              <Switch
                checked={settings.boleto_recovery_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, boleto_recovery_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
              <div>
                <p className="text-xs font-medium">PIX / Cartão</p>
                <p className="text-[10px] text-muted-foreground">Recuperar pagamentos pendentes</p>
              </div>
              <Switch
                checked={settings.pix_card_recovery_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, pix_card_recovery_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
              <div>
                <p className="text-xs font-medium">Abandonos</p>
                <p className="text-[10px] text-muted-foreground">Recuperar carrinhos abandonados</p>
              </div>
              <Switch
                checked={settings.abandoned_recovery_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, abandoned_recovery_enabled: checked })}
              />
            </div>
          </div>

          {/* Limits and hours */}
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

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-2 p-3 rounded-lg bg-secondary/10 border border-border/20">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{stats.sent}</p>
                <p className="text-[10px] text-muted-foreground">Enviadas hoje</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-destructive">{stats.failed}</p>
                <p className="text-[10px] text-muted-foreground">Falharam</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{stats.boleto}</p>
                <p className="text-[10px] text-muted-foreground">Boleto</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{stats.pix_card}</p>
                <p className="text-[10px] text-muted-foreground">PIX/Cartão</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{stats.abandoned}</p>
                <p className="text-[10px] text-muted-foreground">Abandonos</p>
              </div>
            </div>
          )}

          {/* Manual trigger */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => runAutoRecovery()}>
              <Send className="h-3.5 w-3.5 mr-2" />
              Executar Todas
            </Button>
            <Button size="sm" variant="outline" onClick={() => runAutoRecovery('boleto')}>
              Boleto
            </Button>
            <Button size="sm" variant="outline" onClick={() => runAutoRecovery('pix_card')}>
              PIX/Cartão
            </Button>
            <Button size="sm" variant="outline" onClick={() => runAutoRecovery('abandoned')}>
              Abandonos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Sync */}
      <DataSyncSection settings={settings} />

      {/* Message Logs */}
      <MessageLogs />
    </div>
  );
}

function DataSyncSection({ settings }: { settings: MessagingSettings }) {
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const syncData = async (action: string, label: string) => {
    if (!settings.server_url) {
      toast.error("Configure a URL da API primeiro");
      return;
    }
    setIsSyncing(action);
    try {
      const { data, error } = await supabase.functions.invoke("sync-external-data", {
        body: { action },
      });
      if (error) throw error;
      if (data?.success) {
        const sent = data.sent || data.customers_synced || data.transactions_created || 0;
        toast.success(`${label} concluída! ${sent} registros enviados`);
      } else {
        toast.error(data?.error || "Erro na sincronização");
      }
    } catch {
      toast.error(`Erro ao sincronizar: ${label}`);
    } finally {
      setIsSyncing(null);
    }
  };

  return (
    <Card className="bg-card/60 border-border/30">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
          Sincronização de Dados
        </CardTitle>
        <CardDescription className="text-xs">
          Envie dados de clientes e transações para sua aplicação externa. Sua aplicação também pode enviar dados via webhook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/20 border border-border/20 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium">Dashboard → Externa</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Envie clientes e transações para sua aplicação</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncData('sync_customers', 'Clientes')}
                disabled={isSyncing !== null}
              >
                {isSyncing === 'sync_customers' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Clientes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncData('sync_transactions', 'Transações')}
                disabled={isSyncing !== null}
              >
                {isSyncing === 'sync_transactions' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Transações
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/20 border border-border/20 space-y-2">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium">Externa → Dashboard</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Sua aplicação envia dados via webhook:</p>
            <code className="text-[10px] block bg-secondary/40 p-2 rounded text-muted-foreground break-all">
              POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-messaging-webhook
            </code>
            <p className="text-[10px] text-muted-foreground mt-1">
              Eventos: <span className="text-foreground">sync_customer</span>, <span className="text-foreground">sync_transaction</span>, <span className="text-foreground">transaction_webhook</span>, <span className="text-foreground">sync_abandoned_event</span>, <span className="text-foreground">bulk_sync</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
