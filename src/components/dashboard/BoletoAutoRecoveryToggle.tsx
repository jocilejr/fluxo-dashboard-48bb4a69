import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Circle, X, Clock, Zap, Settings, Play, Loader2, CheckCircle2, AlertCircle, PauseCircle, Pause, Square, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { InstanceSelectorModal } from "@/components/recovery/InstanceSelectorModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface MessagingSettings {
  id?: string;
  server_url: string;
  api_key: string;
  is_active: boolean;
  boleto_recovery_enabled: boolean;
  boleto_instance_name: string | null;
  boleto_send_hour: number;
  delay_between_messages: number;
  batch_size: number;
  batch_pause_seconds: number;
  max_messages_per_person_per_day: number;
  last_recovery_status: string;
  last_recovery_started_at: string | null;
  last_recovery_finished_at: string | null;
  last_recovery_stats: { boleto?: { sent: number; failed: number; skipped: number }; pix_card?: { sent: number; failed: number; skipped: number }; abandoned?: { sent: number; failed: number; skipped: number } } | null;
  last_recovery_error: string | null;
  [key: string]: unknown;
}

export function BoletoAutoRecoveryToggle() {
  const queryClient = useQueryClient();
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["messaging-api-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messaging_api_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as MessagingSettings | null;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.last_recovery_status;
      return (status === 'running' || status === 'paused') ? 3000 : false;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("messaging_api_settings")
        .update(patch)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging-api-settings"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const apiConfigured = !!settings?.server_url && !!settings?.api_key && !!settings?.is_active;
  const enabled = settings?.boleto_recovery_enabled ?? false;
  const instanceName = settings?.boleto_instance_name ?? null;
  const sendHour = settings?.boleto_send_hour ?? 9;
  const delayBetween = settings?.delay_between_messages ?? 5;
  const batchSize = settings?.batch_size ?? 10;
  const batchPause = settings?.batch_pause_seconds ?? 30;
  const maxPerPersonPerDay = settings?.max_messages_per_person_per_day ?? 1;
  const recoveryStatus = settings?.last_recovery_status ?? 'idle';
  const recoveryStartedAt = settings?.last_recovery_started_at;
  const recoveryFinishedAt = settings?.last_recovery_finished_at;
  const recoveryStats = settings?.last_recovery_stats;
  const recoveryError = settings?.last_recovery_error;

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const handleManualRun = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-recovery", {
        body: { forceRun: true, type: "boleto" },
      });
      if (error) throw error;
      const sent = data?.stats?.boleto?.sent ?? 0;
      const skipped = data?.stats?.boleto?.skipped ?? 0;
      toast.success(`Recuperação concluída: ${sent} enviada(s), ${skipped} ignorada(s)`);
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-boletos"] });
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao executar recuperação manual");
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) return null;

  if (!settings) {
    return (
      <Card className="border-border/40 bg-card/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Configure a API de mensagens em <strong>Configurações → API Mensagens</strong> para habilitar a automação.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/40 bg-card/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
          {/* Left: switch + label */}
          <div className="flex items-center gap-3">
            <Switch
              checked={enabled}
              onCheckedChange={(v) => updateMutation.mutate({ boleto_recovery_enabled: v })}
              disabled={!apiConfigured}
            />
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-medium">Automação</span>
                {enabled ? (
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    Ativa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                    Inativa
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {enabled
                  ? `Disparo diário às ${sendHour}h usando a régua de cobrança`
                  : "Ative para enviar mensagens automáticas de cobrança"}
              </p>
            </div>
          </div>

          {/* Right: instance + hour + settings */}
          {enabled && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Instance chip */}
              {instanceName ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                  <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-medium truncate max-w-[100px]">{instanceName}</span>
                  <button
                    onClick={() => updateMutation.mutate({ boleto_instance_name: null })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => apiConfigured && setInstanceModalOpen(true)}
                  disabled={!apiConfigured}
                  className="text-[10px] text-primary hover:underline disabled:text-muted-foreground px-2 py-1 rounded border border-dashed border-border/50"
                >
                  Selecionar instância
                </button>
              )}

              {/* Hour selector */}
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={sendHour}
                  onChange={(e) => {
                    const val = Math.min(23, Math.max(0, Number(e.target.value)));
                    updateMutation.mutate({ boleto_send_hour: val });
                  }}
                  className="bg-secondary/30 border-border/30 h-7 text-xs w-14 text-center"
                />
                <span className="text-xs text-muted-foreground">h</span>
              </div>

              {/* Settings popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-1.5 rounded-md hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
                    <Settings className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-3">Ritmo de envio</p>
                    </div>

                    {/* Delay between messages */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Delay entre mensagens (segundos)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={300}
                        value={delayBetween}
                        onChange={(e) => {
                          const val = Math.min(300, Math.max(0, Number(e.target.value)));
                          updateMutation.mutate({ delay_between_messages: val });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Batch size */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">A cada X mensagens, pausar</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={batchSize}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(1, Number(e.target.value)));
                          updateMutation.mutate({ batch_size: val });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Batch pause */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Pausa do lote (segundos)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={600}
                        value={batchPause}
                        onChange={(e) => {
                          const val = Math.min(600, Math.max(0, Number(e.target.value)));
                          updateMutation.mutate({ batch_pause_seconds: val });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Max per person per day */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Máx. mensagens por pessoa/dia</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={maxPerPersonPerDay}
                        onChange={(e) => {
                          const val = Math.min(10, Math.max(1, Number(e.target.value)));
                          updateMutation.mutate({ max_messages_per_person_per_day: val });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      Após enviar {batchSize} msgs, aguarda {batchPause}s. Máx. {maxPerPersonPerDay} msg(s)/pessoa/dia.
                    </p>

                    <div className="pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 text-xs"
                        disabled={isRunning || !apiConfigured}
                        onClick={handleManualRun}
                      >
                        {isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {isRunning ? "Enviando..." : "Iniciar recuperação agora"}
                      </Button>
                      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                        Dispara a régua de cobrança imediatamente
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Recovery status bar */}
        {enabled && recoveryStatus !== 'idle' && (
          <div className="border-t border-border/30 px-4 py-2 flex items-center gap-2 flex-wrap">
            {recoveryStatus === 'running' && (() => {
              const startedMs = recoveryStartedAt ? Date.now() - new Date(recoveryStartedAt).getTime() : 0;
              const isStale = startedMs > 10 * 60 * 1000;
              if (isStale) {
                return (
                  <>
                    <PauseCircle className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-[11px] font-medium text-yellow-500">Recuperação travou</span>
                    <span className="text-[10px] text-muted-foreground">Iniciada {formatTimeAgo(recoveryStartedAt)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 text-[10px] text-yellow-500 hover:text-yellow-400"
                      onClick={() => updateMutation.mutate({
                        last_recovery_status: 'error',
                        last_recovery_finished_at: new Date().toISOString(),
                        last_recovery_error: 'Timeout — recuperação travou e foi resetada manualmente',
                      })}
                    >
                      Resetar
                    </Button>
                  </>
                );
              }
              return (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-[11px] font-medium text-primary">Recuperação em andamento...</span>
                  {recoveryStartedAt && (
                    <span className="text-[10px] text-muted-foreground">Iniciada {formatTimeAgo(recoveryStartedAt)}</span>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] gap-1 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                      onClick={() => updateMutation.mutate({ last_recovery_status: 'paused' })}
                      disabled={updateMutation.isPending}
                    >
                      <Pause className="h-3 w-3" />
                      Pausar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => updateMutation.mutate({ last_recovery_status: 'stopped' })}
                      disabled={updateMutation.isPending}
                    >
                      <Square className="h-3 w-3" />
                      Parar
                    </Button>
                  </div>
                </>
              );
            })()}
            {recoveryStatus === 'paused' && (
              <>
                <PauseCircle className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-[11px] font-medium text-yellow-500">Recuperação pausada</span>
                {recoveryStartedAt && (
                  <span className="text-[10px] text-muted-foreground">Iniciada {formatTimeAgo(recoveryStartedAt)}</span>
                )}
                <div className="flex items-center gap-1.5 ml-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => updateMutation.mutate({ last_recovery_status: 'running' })}
                    disabled={updateMutation.isPending}
                  >
                    <Play className="h-3 w-3" />
                    Continuar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => updateMutation.mutate({ last_recovery_status: 'stopped' })}
                    disabled={updateMutation.isPending}
                  >
                    <Square className="h-3 w-3" />
                    Parar
                  </Button>
                </div>
              </>
            )}
            {recoveryStatus === 'stopped' && (
              <>
                <Square className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">Parada pelo usuário</span>
                {recoveryFinishedAt && (
                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(recoveryFinishedAt)}</span>
                )}
                {recoveryStats?.boleto && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
                      {recoveryStats.boleto.sent} enviada(s)
                    </Badge>
                  </div>
                )}
              </>
            )}
            {recoveryStatus === 'completed' && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-500">Concluída</span>
                {recoveryFinishedAt && (
                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(recoveryFinishedAt)}</span>
                )}
                {recoveryStats?.boleto && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
                      {recoveryStats.boleto.sent} enviada(s)
                    </Badge>
                    {recoveryStats.boleto.skipped > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground">
                        {recoveryStats.boleto.skipped} ignorada(s)
                      </Badge>
                    )}
                    {recoveryStats.boleto.failed > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 bg-destructive/10 border-destructive/30 text-destructive">
                        {recoveryStats.boleto.failed} falha(s)
                      </Badge>
                    )}
                  </div>
                )}
              </>
            )}
            {recoveryStatus === 'error' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[11px] font-medium text-destructive">Erro na recuperação</span>
                {recoveryError && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={recoveryError}>
                    {recoveryError}
                  </span>
                )}
                {recoveryFinishedAt && (
                  <span className="text-[10px] text-muted-foreground ml-auto">{formatTimeAgo(recoveryFinishedAt)}</span>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {instanceModalOpen && settings && (
        <InstanceSelectorModal
          open={instanceModalOpen}
          onOpenChange={setInstanceModalOpen}
          serverUrl={settings.server_url}
          apiKey={settings.api_key}
          currentInstance={instanceName}
          onSelect={(name) => {
            updateMutation.mutate({ boleto_instance_name: name });
            setInstanceModalOpen(false);
          }}
          title="Selecionar instância — Boleto"
        />
      )}
    </>
  );
}
