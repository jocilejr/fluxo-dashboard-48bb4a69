import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, GripVertical, Calendar, MessageSquare, Settings } from "lucide-react";

interface RecoveryRule {
  id: string;
  name: string;
  rule_type: "immediate" | "days_after_generation" | "days_before_due" | "days_after_due";
  days: number;
  message: string;
  is_active: boolean;
  priority: number;
}

interface BoletoSettings {
  id: string;
  default_expiration_days: number;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  immediate: "Imediatamente",
  days_after_generation: "Dias após geração",
  days_before_due: "Dias antes do vencimento",
  days_after_due: "Dias após vencimento",
};

const VARIABLE_HINTS = [
  { var: "{saudação}", desc: "Bom dia/tarde/noite" },
  { var: "{nome}", desc: "Nome completo" },
  { var: "{primeiro_nome}", desc: "Primeiro nome" },
  { var: "{valor}", desc: "Valor do boleto" },
  { var: "{vencimento}", desc: "Data de vencimento" },
  { var: "{codigo_barras}", desc: "Código de barras" },
];

export function BoletoRecoveryRulesConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<Partial<RecoveryRule> | null>(null);
  const [expirationDays, setExpirationDays] = useState("");

  // Fetch settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["boleto-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) setExpirationDays(data.default_expiration_days.toString());
      return data as BoletoSettings | null;
    },
  });

  // Fetch rules
  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ["boleto-recovery-rules-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_recovery_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as RecoveryRule[];
    },
  });

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async (days: number) => {
      if (!settings?.id) {
        const { error } = await supabase.from("boleto_settings").insert({ default_expiration_days: days });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("boleto_settings").update({ default_expiration_days: days }).eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Dias para vencimento atualizados" });
      queryClient.invalidateQueries({ queryKey: ["boleto-settings"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar", variant: "destructive" });
    },
  });

  // Create/Update rule
  const saveRule = useMutation({
    mutationFn: async (rule: Partial<RecoveryRule>) => {
      if (rule.id) {
        const { error } = await supabase
          .from("boleto_recovery_rules")
          .update({
            name: rule.name,
            rule_type: rule.rule_type,
            days: rule.days,
            message: rule.message,
            is_active: rule.is_active,
          })
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const maxPriority = rules?.reduce((max, r) => Math.max(max, r.priority), 0) || 0;
        const { error } = await supabase.from("boleto_recovery_rules").insert({
          name: rule.name,
          rule_type: rule.rule_type,
          days: rule.days,
          message: rule.message,
          is_active: rule.is_active ?? true,
          priority: maxPriority + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Regra salva" });
      setEditingRule(null);
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules-all"] });
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar", variant: "destructive" });
    },
  });

  // Toggle rule active
  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("boleto_recovery_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules-all"] });
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules"] });
    },
  });

  // Delete rule
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boleto_recovery_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Regra removida" });
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules-all"] });
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível remover", variant: "destructive" });
    },
  });

  const handleNewRule = () => {
    setEditingRule({
      name: "",
      rule_type: "days_after_generation",
      days: 1,
      message: "{saudação}, {primeiro_nome}! ",
      is_active: true,
    });
  };

  if (loadingSettings || loadingRules) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Expiration Days Setting */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Dias para Vencimento do Boleto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Quantidade de dias após a geração para calcular o vencimento do boleto
          </p>
          <div className="flex gap-2 items-end">
            <div className="space-y-2 flex-1 max-w-[200px]">
              <Label htmlFor="expDays">Dias</Label>
              <Input
                id="expDays"
                type="number"
                min="1"
                max="30"
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value)}
              />
            </div>
            <Button
              onClick={() => {
                const days = parseInt(expirationDays);
                if (isNaN(days) || days < 1 || days > 30) {
                  toast({ title: "Erro", description: "Digite um valor entre 1 e 30", variant: "destructive" });
                  return;
                }
                updateSettings.mutate(days);
              }}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Rules */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Régua de Cobrança
            </CardTitle>
            <Button onClick={handleNewRule} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Variable hints */}
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg overflow-x-auto">
            <span className="text-xs text-muted-foreground mr-2 shrink-0">Variáveis:</span>
            {VARIABLE_HINTS.map((v) => (
              <Badge key={v.var} variant="secondary" className="text-xs font-mono shrink-0">
                {v.var}
              </Badge>
            ))}
          </div>

          {/* Editing Form */}
          {editingRule && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da regra</Label>
                    <Input
                      placeholder="Ex: 1 dia após geração"
                      value={editingRule.name || ""}
                      onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="space-y-2 flex-1">
                      <Label>Tipo</Label>
                      <Select
                        value={editingRule.rule_type}
                        onValueChange={(v) => setEditingRule({ ...editingRule, rule_type: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Imediatamente ao gerar</SelectItem>
                          <SelectItem value="days_after_generation">Dias após geração</SelectItem>
                          <SelectItem value="days_before_due">Dias antes do vencimento</SelectItem>
                          <SelectItem value="days_after_due">Dias após vencimento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editingRule.rule_type !== 'immediate' && (
                      <div className="space-y-2 w-20">
                        <Label>Dias</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editingRule.days ?? 1}
                          onChange={(e) => setEditingRule({ ...editingRule, days: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    placeholder="Digite a mensagem de recuperação..."
                    value={editingRule.message || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, message: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setEditingRule(null)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      if (!editingRule.name || !editingRule.message) {
                        toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
                        return;
                      }
                      saveRule.mutate(editingRule);
                    }}
                    disabled={saveRule.isPending}
                  >
                    {saveRule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rules List */}
          <div className="space-y-2">
            {rules && rules.length > 0 ? (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center gap-2 sm:gap-3 p-3 border rounded-lg transition-opacity ${
                    !rule.is_active ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab hidden sm:block shrink-0" />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{rule.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {rule.days} {RULE_TYPE_LABELS[rule.rule_type]?.split(" ").slice(1).join(" ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{rule.message}</p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hidden sm:flex"
                      onClick={() => deleteRule.mutate(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma regra configurada
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
