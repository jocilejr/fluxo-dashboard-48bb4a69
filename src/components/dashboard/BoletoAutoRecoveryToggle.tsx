import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Circle, X, Clock, Zap, Settings, Play, Loader2 } from "lucide-react";
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
  [key: string]: unknown;
}

export function BoletoAutoRecoveryToggle() {
  const queryClient = useQueryClient();
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);

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
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
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
