import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Smartphone, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { InstanceSelectorModal } from "@/components/recovery/InstanceSelectorModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RecoveryType = "boleto" | "pix_card" | "abandoned";

interface AutoRecoveryToggleBarProps {
  type: RecoveryType;
  isAdmin: boolean;
}

const labels: Record<RecoveryType, string> = {
  boleto: "Auto Rec. Boletos",
  pix_card: "Auto Rec. PIX/Cartão",
  abandoned: "Auto Rec. Abandonos",
};

const enabledKeys: Record<RecoveryType, string> = {
  boleto: "boleto_recovery_enabled",
  pix_card: "pix_card_recovery_enabled",
  abandoned: "abandoned_recovery_enabled",
};

const instanceKeys: Record<RecoveryType, string> = {
  boleto: "boleto_instance_name",
  pix_card: "pix_card_instance_name",
  abandoned: "abandoned_instance_name",
};

export function AutoRecoveryToggleBar({ type, isAdmin }: AutoRecoveryToggleBarProps) {
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["messaging-api-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messaging_api_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch boleto recovery templates (only for boleto type)
  const { data: templates } = useQuery({
    queryKey: ["boleto-recovery-templates-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_recovery_templates")
        .select("id, name, is_default")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: type === "boleto",
  });

  const defaultTemplate = templates?.find(t => t.is_default);

  const setDefaultTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      await supabase
        .from("boleto_recovery_templates")
        .update({ is_default: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      const { error } = await supabase
        .from("boleto_recovery_templates")
        .update({ is_default: true })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-templates-list"] });
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-templates"] });
      toast.success("Template padrão atualizado");
    },
    onError: () => toast.error("Erro ao atualizar template"),
  });

  const mutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!settings?.id) throw new Error("Settings not found");
      const { error } = await supabase
        .from("messaging_api_settings")
        .update(updates)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging-api-settings"] });
    },
    onError: () => {
      toast.error("Erro ao salvar configuração");
    },
  });

  if (!isAdmin || isLoading || !settings) return null;

  const isEnabled = !!settings[enabledKeys[type] as keyof typeof settings];
  const instanceName = settings[instanceKeys[type] as keyof typeof settings] as string | null;

  const handleToggle = (checked: boolean) => {
    mutation.mutate({ [enabledKeys[type]]: checked });
  };

  const handleInstanceSelect = (name: string) => {
    mutation.mutate({ [instanceKeys[type]]: name });
    toast.success(`Instância "${name}" selecionada`);
  };

  const handleRemoveInstance = () => {
    mutation.mutate({ [instanceKeys[type]]: null });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-lg border border-border/30 bg-secondary/20">
      <Switch
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={mutation.isPending}
      />
      <span className="text-xs font-medium text-muted-foreground">{labels[type]}</span>

      {isEnabled && (
        <div className="flex items-center gap-2 ml-auto">
          {/* Template selector - only for boleto */}
          {type === "boleto" && templates && templates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <Select
                value={defaultTemplate?.id || ""}
                onValueChange={(val) => setDefaultTemplate.mutate(val)}
              >
                <SelectTrigger className="bg-secondary/30 border-border/30 h-7 text-xs w-[140px]">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {instanceName ? (
            <button
              onClick={() => setInstanceModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Smartphone className="h-3 w-3" />
              {instanceName}
              <span
                onClick={(e) => { e.stopPropagation(); handleRemoveInstance(); }}
                className="ml-1 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                ×
              </span>
            </button>
          ) : (
            <button
              onClick={() => setInstanceModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-border/50 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Smartphone className="h-3 w-3" />
              Selecionar instância
            </button>
          )}
        </div>
      )}

      {mutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}

      <InstanceSelectorModal
        open={instanceModalOpen}
        onOpenChange={setInstanceModalOpen}
        serverUrl={settings.server_url || ""}
        apiKey={settings.api_key || ""}
        currentInstance={instanceName}
        onSelect={handleInstanceSelect}
        title={`Instância para ${labels[type]}`}
      />
    </div>
  );
}
