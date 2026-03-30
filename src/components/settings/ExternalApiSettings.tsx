import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Wifi, WifiOff, Send, Settings2, RefreshCw, Users, ArrowUpDown, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageLogs } from "./MessageLogs";

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
};

interface WhatsAppInstance {
  instance_name: string;
  status?: string;
  [key: string]: unknown;
}

function InstanceSelectorModal({
  open,
  onOpenChange,
  serverUrl,
  apiKey,
  currentInstance,
  onSelect,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverUrl: string;
  apiKey: string;
  currentInstance: string | null;
  onSelect: (instanceName: string) => void;
  title: string;
}) {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && serverUrl && apiKey) {
      fetchInstances();
    }
  }, [open]);

  const fetchInstances = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-instances', {
        body: { server_url: serverUrl, api_key: apiKey },
      });
      if (fnError) throw new Error(fnError.message || 'Erro ao buscar instâncias');
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar instâncias');
      setInstances(data.instances || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar instâncias');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando instâncias...</span>
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              {error}
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={fetchInstances}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!isLoading && !error && instances.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma instância encontrada</p>
          )}
          {!isLoading && instances.map((inst) => (
            <button
              key={inst.instance_name}
              onClick={() => {
                onSelect(inst.instance_name);
                onOpenChange(false);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                currentInstance === inst.instance_name
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-secondary/20 border-border/20 hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span className="text-sm font-medium">{inst.instance_name}</span>
              </div>
              {inst.status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  inst.status === 'open' || inst.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {inst.status}
                </span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExternalApiSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<MessagingSettings>(defaultSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");
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
    if (savedSettings) {
      setSettings(savedSettings);
    }
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
      const { data, error } = await supabase.functions.invoke('test-external-connection', {
        body: {
          server_url: settings.server_url,
          api_key: settings.api_key,
        },
      });
      if (error) throw error;
      if (data?.success) {
        setConnectionStatus("connected");
        toast.success("Conexão com API externa estabelecida!");
      } else {
        setConnectionStatus("error");
        toast.error(data?.error || "API externa não respondeu corretamente");
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

          <div className="space-y-2">
            <Label className="text-xs">Webhook URL (eventos de saída)</Label>
            <Input
              placeholder="https://sua-api.com/api/webhook"
              value={settings.webhook_url}
              onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
              className="bg-secondary/30 border-border/30 h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              URL onde sua aplicação receberá notificações quando dados mudarem no dashboard (lembretes, transações, etc.)
            </p>
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
              <Button variant="outline" size="sm" onClick={testConnection} disabled={isTesting}>
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
              <Button size="sm" onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
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
            Configure quais tipos de recuperação automática estão ativos e suas instâncias WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Boleto */}
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Boleto</p>
                  <p className="text-[10px] text-muted-foreground">Recuperar boletos pendentes</p>
                </div>
                <Switch
                  checked={settings.boleto_recovery_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, boleto_recovery_enabled: checked })}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[11px]"
                onClick={() => setInstanceModal({ open: true, type: 'boleto' })}
                disabled={!settings.server_url || !settings.api_key}
              >
                <Smartphone className="h-3 w-3 mr-1.5" />
                {settings.boleto_instance_name || 'Selecionar instância'}
              </Button>
            </div>

            {/* PIX / Cartão */}
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">PIX / Cartão</p>
                  <p className="text-[10px] text-muted-foreground">Recuperar pagamentos pendentes</p>
                </div>
                <Switch
                  checked={settings.pix_card_recovery_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, pix_card_recovery_enabled: checked })}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[11px]"
                onClick={() => setInstanceModal({ open: true, type: 'pix_card' })}
                disabled={!settings.server_url || !settings.api_key}
              >
                <Smartphone className="h-3 w-3 mr-1.5" />
                {settings.pix_card_instance_name || 'Selecionar instância'}
              </Button>
            </div>

            {/* Abandonos */}
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Abandonos</p>
                  <p className="text-[10px] text-muted-foreground">Recuperar carrinhos abandonados</p>
                </div>
                <Switch
                  checked={settings.abandoned_recovery_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, abandoned_recovery_enabled: checked })}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[11px]"
                onClick={() => setInstanceModal({ open: true, type: 'abandoned' })}
                disabled={!settings.server_url || !settings.api_key}
              >
                <Smartphone className="h-3 w-3 mr-1.5" />
                {settings.abandoned_instance_name || 'Selecionar instância'}
              </Button>
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
          Envie dados de clientes e transações para sua aplicação externa
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
        </div>
      </CardContent>
    </Card>
  );
}
