import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Circle, X, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { InstanceSelectorModal } from "@/components/recovery/InstanceSelectorModal";

interface MessagingSettings {
  id?: string;
  server_url: string;
  api_key: string;
  is_active: boolean;
  boleto_recovery_enabled: boolean;
  boleto_instance_name: string | null;
  boleto_send_hour: number;
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

          {/* Right: instance + hour */}
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
