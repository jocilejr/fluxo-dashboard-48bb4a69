import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wifi, WifiOff, Send, Play, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface EvolutionSettings {
  id?: string;
  server_url: string;
  api_key: string;
  instance_name: string;
  is_active: boolean;
  boleto_recovery_enabled: boolean;
  pix_card_recovery_enabled: boolean;
  abandoned_recovery_enabled: boolean;
  delay_between_messages: number;
  daily_limit: number;
  cron_enabled: boolean;
  cron_interval_minutes: number;
  working_hours_start: number;
  working_hours_end: number;
}

const defaultSettings: EvolutionSettings = {
  server_url: "",
  api_key: "",
  instance_name: "",
  is_active: false,
  boleto_recovery_enabled: false,
  pix_card_recovery_enabled: false,
  abandoned_recovery_enabled: false,
  delay_between_messages: 5,
  daily_limit: 100,
  cron_enabled: false,
  cron_interval_minutes: 60,
  working_hours_start: 8,
  working_hours_end: 20,
};

export function EvolutionApiSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<EvolutionSettings>(defaultSettings);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [isRunningRecovery, setIsRunningRecovery] = useState(false);

  // Fetch settings
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["evolution-api-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evolution_api_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as EvolutionSettings | null;
    },
  });

  // Fetch today's stats
  const { data: todayStats } = useQuery({
    queryKey: ["evolution-today-stats"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from("evolution_message_log")
        .select("status, message_type")
        .gte("created_at", todayStart.toISOString());
      
      if (error) throw error;
      
      const stats = {
        total: data?.length || 0,
        sent: data?.filter(m => m.status === 'sent').length || 0,
        failed: data?.filter(m => m.status === 'failed').length || 0,
        boleto: data?.filter(m => m.message_type === 'boleto').length || 0,
        pix_card: data?.filter(m => m.message_type === 'pix_card').length || 0,
        abandoned: data?.filter(m => m.message_type === 'abandoned').length || 0,
      };
      
      return stats;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, [savedSettings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: EvolutionSettings) => {
      if (newSettings.id) {
        const { error } = await supabase
          .from("evolution_api_settings")
          .update({
            server_url: newSettings.server_url,
            api_key: newSettings.api_key,
            instance_name: newSettings.instance_name,
            is_active: newSettings.is_active,
            boleto_recovery_enabled: newSettings.boleto_recovery_enabled,
            pix_card_recovery_enabled: newSettings.pix_card_recovery_enabled,
            abandoned_recovery_enabled: newSettings.abandoned_recovery_enabled,
            delay_between_messages: newSettings.delay_between_messages,
            daily_limit: newSettings.daily_limit,
            cron_enabled: newSettings.cron_enabled,
            cron_interval_minutes: newSettings.cron_interval_minutes,
            working_hours_start: newSettings.working_hours_start,
            working_hours_end: newSettings.working_hours_end,
          })
          .eq("id", newSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("evolution_api_settings")
          .insert({
            server_url: newSettings.server_url,
            api_key: newSettings.api_key,
            instance_name: newSettings.instance_name,
            is_active: newSettings.is_active,
            boleto_recovery_enabled: newSettings.boleto_recovery_enabled,
            pix_card_recovery_enabled: newSettings.pix_card_recovery_enabled,
            abandoned_recovery_enabled: newSettings.abandoned_recovery_enabled,
            delay_between_messages: newSettings.delay_between_messages,
            daily_limit: newSettings.daily_limit,
            cron_enabled: newSettings.cron_enabled,
            cron_interval_minutes: newSettings.cron_interval_minutes,
            working_hours_start: newSettings.working_hours_start,
            working_hours_end: newSettings.working_hours_end,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution-api-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });

  const handleTestConnection = async () => {
    if (!settings.server_url || !settings.api_key || !settings.instance_name) {
      toast.error("Preencha URL, API Key e Nome da Instância");
      return;
    }

    setIsTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-test-connection", {
        body: {
          serverUrl: settings.server_url,
          apiKey: settings.api_key,
          instanceName: settings.instance_name,
        },
      });

      if (error) throw error;

      if (data.success && data.connected) {
        setConnectionStatus('connected');
        toast.success("Conexão estabelecida com sucesso!");
      } else if (data.success) {
        setConnectionStatus('disconnected');
        toast.warning(`Instância encontrada mas não conectada (${data.state})`);
      } else {
        setConnectionStatus('disconnected');
        toast.error(data.error || "Erro ao conectar");
      }
    } catch (error: any) {
      setConnectionStatus('disconnected');
      toast.error("Erro ao testar conexão: " + error.message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleRunRecovery = async (type?: string) => {
    setIsRunningRecovery(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-auto-recovery", {
        body: { forceRun: true, type },
      });

      if (error) throw error;

      if (data.success) {
        const stats = data.stats;
        const totalSent = data.totalSent || 0;
        toast.success(`Recuperação executada! ${totalSent} mensagens enviadas.`);
        queryClient.invalidateQueries({ queryKey: ["evolution-today-stats"] });
      } else {
        toast.error(data.error || "Erro ao executar recuperação");
      }
    } catch (error: any) {
      toast.error("Erro ao executar recuperação: " + error.message);
    } finally {
      setIsRunningRecovery(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuração da Evolution API
          </CardTitle>
          <CardDescription>
            Configure sua instância da Evolution API para envio automático de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server_url">URL do Servidor</Label>
              <Input
                id="server_url"
                placeholder="https://sua-evolution-api.com"
                value={settings.server_url}
                onChange={(e) => setSettings({ ...settings, server_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance_name">Nome da Instância</Label>
              <Input
                id="instance_name"
                placeholder="minha-instancia"
                value={settings.instance_name}
                onChange={(e) => setSettings({ ...settings, instance_name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              placeholder="Sua API Key da Evolution API"
              value={settings.api_key}
              onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : connectionStatus === 'connected' ? (
                <Wifi className="h-4 w-4 mr-2 text-green-500" />
              ) : connectionStatus === 'disconnected' ? (
                <WifiOff className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={settings.is_active}
                onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
              />
              <Label htmlFor="is_active">Integração Ativa</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Types Card */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Automação</CardTitle>
          <CardDescription>
            Escolha quais tipos de recuperação deseja automatizar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Recuperação de Boletos</p>
              <p className="text-sm text-muted-foreground">
                Envia mensagens baseadas nas regras configuradas
              </p>
            </div>
            <Switch
              checked={settings.boleto_recovery_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, boleto_recovery_enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Recuperação de PIX/Cartão</p>
              <p className="text-sm text-muted-foreground">
                Envia mensagens para transações pendentes das últimas 24h
              </p>
            </div>
            <Switch
              checked={settings.pix_card_recovery_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, pix_card_recovery_enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Recuperação de Carrinho Abandonado</p>
              <p className="text-sm text-muted-foreground">
                Envia mensagens para abandonos das últimas 24h
              </p>
            </div>
            <Switch
              checked={settings.abandoned_recovery_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, abandoned_recovery_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Limits and Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle>Limites e Horários</CardTitle>
          <CardDescription>
            Configure os limites de envio e horário de funcionamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="daily_limit">Limite Diário de Mensagens</Label>
              <Input
                id="daily_limit"
                type="number"
                min="1"
                value={settings.daily_limit}
                onChange={(e) => setSettings({ ...settings, daily_limit: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delay">Delay Entre Mensagens (segundos)</Label>
              <Input
                id="delay"
                type="number"
                min="1"
                value={settings.delay_between_messages}
                onChange={(e) => setSettings({ ...settings, delay_between_messages: parseInt(e.target.value) || 5 })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="working_start">Horário de Início</Label>
              <Input
                id="working_start"
                type="number"
                min="0"
                max="23"
                value={settings.working_hours_start}
                onChange={(e) => setSettings({ ...settings, working_hours_start: parseInt(e.target.value) || 8 })}
              />
              <p className="text-xs text-muted-foreground">Hora (0-23)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="working_end">Horário de Fim</Label>
              <Input
                id="working_end"
                type="number"
                min="0"
                max="23"
                value={settings.working_hours_end}
                onChange={(e) => setSettings({ ...settings, working_hours_end: parseInt(e.target.value) || 20 })}
              />
              <p className="text-xs text-muted-foreground">Hora (0-23)</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <Switch
              id="cron_enabled"
              checked={settings.cron_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, cron_enabled: checked })}
            />
            <Label htmlFor="cron_enabled">Executar automaticamente</Label>
            
            {settings.cron_enabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">a cada</span>
                <Input
                  type="number"
                  min="15"
                  className="w-20"
                  value={settings.cron_interval_minutes}
                  onChange={(e) => setSettings({ ...settings, cron_interval_minutes: parseInt(e.target.value) || 60 })}
                />
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats and Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas de Hoje</CardTitle>
          <CardDescription>
            Mensagens enviadas hoje e ações manuais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayStats && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold">{todayStats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold text-green-500">{todayStats.sent}</p>
                <p className="text-sm text-muted-foreground">Enviadas</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold text-red-500">{todayStats.failed}</p>
                <p className="text-sm text-muted-foreground">Falharam</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold">{settings.daily_limit - todayStats.sent}</p>
                <p className="text-sm text-muted-foreground">Restantes</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4">
            <Button
              onClick={() => handleRunRecovery()}
              disabled={isRunningRecovery || !settings.is_active}
            >
              {isRunningRecovery ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar Todas as Recuperações
            </Button>

            <Button
              variant="outline"
              onClick={() => handleRunRecovery('boleto')}
              disabled={isRunningRecovery || !settings.is_active || !settings.boleto_recovery_enabled}
            >
              <Send className="h-4 w-4 mr-2" />
              Boletos
            </Button>

            <Button
              variant="outline"
              onClick={() => handleRunRecovery('pix_card')}
              disabled={isRunningRecovery || !settings.is_active || !settings.pix_card_recovery_enabled}
            >
              <Send className="h-4 w-4 mr-2" />
              PIX/Cartão
            </Button>

            <Button
              variant="outline"
              onClick={() => handleRunRecovery('abandoned')}
              disabled={isRunningRecovery || !settings.is_active || !settings.abandoned_recovery_enabled}
            >
              <Send className="h-4 w-4 mr-2" />
              Abandonos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
