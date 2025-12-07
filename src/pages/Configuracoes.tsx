import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, DollarSign, MessageSquare, Link as LinkIcon, Shield, Bell, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DataImportExport from "@/components/settings/DataImportExport";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WebhooksSection } from "@/components/dashboard/WebhooksSection";
import { Trash2, Plus, Loader2, Key, Smartphone, Save } from "lucide-react";

interface UserWithPermissions {
  user_id: string;
  email: string;
  role: string;
  permissions: { permission_key: string; is_allowed: boolean }[];
}

interface WirePusherTemplate {
  id: string;
  event_type: string;
  title: string;
  message: string;
  notification_type: string;
  is_active: boolean;
}

const AVAILABLE_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", description: "Métricas e visão geral" },
  { key: "transacoes", label: "Transações", description: "Lista de transações" },
  { key: "clientes", label: "Clientes", description: "Lista de clientes" },
  { key: "recuperacao", label: "Recuperação", description: "Recuperação de boletos" },
  { key: "entrega", label: "Entrega", description: "Produtos digitais" },
  { key: "projetos", label: "Quadros", description: "Gestão de projetos" },
  { key: "gerar_boleto", label: "Gerar Boleto", description: "Geração manual de boletos" },
  { key: "links_uteis", label: "Links Úteis", description: "Links compartilhados" },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  boleto_gerado: "📄 Boleto Gerado",
  boleto_pago: "✅ Boleto Pago",
  pix_gerado: "🔷 PIX Gerado",
  pix_pago: "✅ PIX Pago",
  pix_pendente: "⏳ PIX Pendente",
  cartao_gerado: "💳 Cartão - Pedido",
  cartao_pago: "✅ Cartão Pago",
  cartao_pendente: "⏳ Cartão Pendente",
};

const Configuracoes = () => {
  const queryClient = useQueryClient();
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [taxRate, setTaxRate] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [boletoWebhook, setBoletoWebhook] = useState("");
  const [newRevenueDescription, setNewRevenueDescription] = useState("");
  const [newRevenueAmount, setNewRevenueAmount] = useState("");
  
  // WirePusher states
  const [wirePusherDeviceId, setWirePusherDeviceId] = useState("");
  const [wirePusherEnabled, setWirePusherEnabled] = useState(true);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, WirePusherTemplate>>({});

  // Fetch users with their permissions
  const { data: usersWithPermissions, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users-with-permissions"],
    queryFn: async () => {
      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      // Get all permissions
      const { data: permissions, error: permError } = await supabase
        .from("user_permissions")
        .select("*");
      if (permError) throw permError;

      // Get user emails from auth admin function or profiles
      const users: UserWithPermissions[] = [];
      
      for (const role of roles || []) {
        const userPerms = permissions?.filter(p => p.user_id === role.user_id) || [];
        users.push({
          user_id: role.user_id,
          email: role.user_id.substring(0, 8) + "...", // Placeholder - will need to fetch from profiles
          role: role.role,
          permissions: userPerms.map(p => ({ permission_key: p.permission_key, is_allowed: p.is_allowed })),
        });
      }
      
      return users;
    },
  });

  // Fetch financial settings
  const { data: financialSettings } = useQuery({
    queryKey: ["financial-settings-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch manual revenues
  const { data: manualRevenues } = useQuery({
    queryKey: ["manual-revenues-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_revenues")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch recovery message
  const { data: recoverySettings } = useQuery({
    queryKey: ["pix-card-recovery-settings-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pix_card_recovery_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch boleto webhook
  const { data: boletoSettings } = useQuery({
    queryKey: ["manual-boleto-settings-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_boleto_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch WirePusher settings
  const { data: wirePusherSettings } = useQuery({
    queryKey: ["wirepusher-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wirepusher_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch WirePusher templates
  const { data: wirePusherTemplates } = useQuery({
    queryKey: ["wirepusher-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wirepusher_notification_templates")
        .select("*")
        .order("event_type");
      if (error) throw error;
      return data as WirePusherTemplate[];
    },
  });

  useEffect(() => {
    if (financialSettings) setTaxRate(String(financialSettings.tax_rate || ""));
    if (recoverySettings) setRecoveryMessage(recoverySettings.message || "");
    if (boletoSettings) setBoletoWebhook(boletoSettings.webhook_url || "");
  }, [financialSettings, recoverySettings, boletoSettings]);

  useEffect(() => {
    if (wirePusherSettings) {
      setWirePusherDeviceId(wirePusherSettings.device_id || "");
      setWirePusherEnabled(wirePusherSettings.is_enabled ?? true);
    }
  }, [wirePusherSettings]);

  useEffect(() => {
    if (wirePusherTemplates) {
      const templatesMap: Record<string, WirePusherTemplate> = {};
      wirePusherTemplates.forEach(t => {
        templatesMap[t.id] = { ...t };
      });
      setEditedTemplates(templatesMap);
    }
  }, [wirePusherTemplates]);

  // Update permission mutation
  const updatePermission = useMutation({
    mutationFn: async ({ userId, permissionKey, isAllowed }: { userId: string; permissionKey: string; isAllowed: boolean }) => {
      const { data: existing } = await supabase
        .from("user_permissions")
        .select("id")
        .eq("user_id", userId)
        .eq("permission_key", permissionKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update({ is_allowed: isAllowed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: userId, permission_key: permissionKey, is_allowed: isAllowed });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-permissions"] });
      toast.success("Permissão atualizada");
    },
    onError: () => {
      toast.error("Erro ao atualizar permissão");
    },
  });

  // Update tax rate mutation
  const updateTaxRate = useMutation({
    mutationFn: async (rate: number) => {
      const { data: existing } = await supabase
        .from("financial_settings")
        .select("id")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("financial_settings")
          .update({ tax_rate: rate })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_settings")
          .insert({ tax_rate: rate });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-settings-config"] });
      toast.success("Taxa atualizada");
    },
  });

  // Update recovery message mutation
  const updateRecoveryMessage = useMutation({
    mutationFn: async (message: string) => {
      const { data: existing } = await supabase
        .from("pix_card_recovery_settings")
        .select("id")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("pix_card_recovery_settings")
          .update({ message })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pix_card_recovery_settings")
          .insert({ message });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pix-card-recovery-settings-config"] });
      toast.success("Mensagem atualizada");
    },
  });

  // Update boleto webhook mutation
  const updateBoletoWebhook = useMutation({
    mutationFn: async (webhookUrl: string) => {
      const { data: existing } = await supabase
        .from("manual_boleto_settings")
        .select("id")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("manual_boleto_settings")
          .update({ webhook_url: webhookUrl })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("manual_boleto_settings")
          .insert({ webhook_url: webhookUrl });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-boleto-settings-config"] });
      toast.success("Webhook atualizado");
    },
  });

  // Add manual revenue mutation
  const addManualRevenue = useMutation({
    mutationFn: async ({ description, amount }: { description: string; amount: number }) => {
      const { error } = await supabase
        .from("manual_revenues")
        .insert({ description, amount });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-revenues-config"] });
      setNewRevenueDescription("");
      setNewRevenueAmount("");
      toast.success("Receita adicionada");
    },
  });

  // Delete manual revenue mutation
  const deleteManualRevenue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("manual_revenues")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-revenues-config"] });
      toast.success("Receita removida");
    },
  });

  // Update WirePusher settings mutation
  const updateWirePusherSettings = useMutation({
    mutationFn: async ({ deviceId, isEnabled }: { deviceId: string; isEnabled: boolean }) => {
      const { data: existing } = await supabase
        .from("wirepusher_settings")
        .select("id")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("wirepusher_settings")
          .update({ device_id: deviceId, is_enabled: isEnabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wirepusher_settings")
          .insert({ device_id: deviceId, is_enabled: isEnabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wirepusher-settings"] });
      toast.success("Configurações WirePusher salvas");
    },
    onError: () => {
      toast.error("Erro ao salvar configurações");
    },
  });

  // Update WirePusher template mutation
  const updateWirePusherTemplate = useMutation({
    mutationFn: async (template: WirePusherTemplate) => {
      const { error } = await supabase
        .from("wirepusher_notification_templates")
        .update({
          title: template.title,
          message: template.message,
          notification_type: template.notification_type,
          is_active: template.is_active,
        })
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wirepusher-templates"] });
      toast.success("Template atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar template");
    },
  });

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error("Preencha email e senha");
      return;
    }
    setIsCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newUserEmail, password: newUserPassword },
      });
      if (error) throw error;
      toast.success("Usuário criado com sucesso");
      setNewUserEmail("");
      setNewUserPassword("");
      queryClient.invalidateQueries({ queryKey: ["users-with-permissions"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId },
      });
      if (error) throw error;
      toast.success("Usuário removido");
      queryClient.invalidateQueries({ queryKey: ["users-with-permissions"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover usuário");
    }
  };

  const resetPassword = async (userId: string) => {
    const newPassword = prompt("Digite a nova senha:");
    if (!newPassword) return;
    try {
      const { error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId, newPassword },
      });
      if (error) throw error;
      toast.success("Senha resetada com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao resetar senha");
    }
  };

  const getUserPermission = (user: UserWithPermissions, permKey: string) => {
    const perm = user.permissions.find(p => p.permission_key === permKey);
    return perm ? perm.is_allowed : true; // Default to allowed if no record
  };

  const handleTemplateChange = (templateId: string, field: keyof WirePusherTemplate, value: string | boolean) => {
    setEditedTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [field]: value,
      },
    }));
  };

  const saveTemplate = (templateId: string) => {
    const template = editedTemplates[templateId];
    if (template) {
      updateWirePusherTemplate.mutate(template);
    }
  };

  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <Tabs defaultValue="users" className="w-full">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          <TabsList className="bg-secondary/30 border border-border/30 p-1 h-auto flex-wrap">
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background text-xs">
              <Users className="h-3.5 w-3.5" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background text-xs">
              <Shield className="h-3.5 w-3.5" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="recovery" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Recuperação
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background text-xs">
              <Bell className="h-3.5 w-3.5" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background text-xs">
              <LinkIcon className="h-3.5 w-3.5" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background text-xs">
              <Database className="h-3.5 w-3.5" />
              Dados
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-foreground">Gerenciar Usuários</h3>
              <p className="text-xs text-muted-foreground">Adicione ou remova usuários do sistema</p>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="bg-secondary/30 border-border/30 h-9 text-sm"
                />
                <Input
                  type="password"
                  placeholder="Senha"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="bg-secondary/30 border-border/30 h-9 text-sm"
                />
                <Button onClick={createUser} disabled={isCreatingUser} size="sm" className="h-9">
                  {isCreatingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
                  Criar Usuário
                </Button>
              </div>

              <div className="space-y-2">
                {usersWithPermissions?.filter(u => u.role !== "admin").map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
                    <span className="text-sm">{user.email}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => resetPassword(user.user_id)} className="h-8 w-8 p-0">
                        <Key className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteUser(user.user_id)} className="h-8 w-8 p-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground">Controle de Acesso</h3>
              <p className="text-xs text-muted-foreground">Defina quais seções cada colaborador pode acessar na sidebar</p>
            </div>
            
            {(!usersWithPermissions || usersWithPermissions.filter(u => u.role !== "admin").length === 0) ? (
              <p className="text-muted-foreground text-center py-8 text-sm">Nenhum colaborador cadastrado</p>
            ) : (
              <div className="space-y-6">
                {usersWithPermissions?.filter(u => u.role !== "admin").map((user) => (
                  <div key={user.user_id} className="p-4 rounded-xl bg-secondary/20 border border-border/20">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/20">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{user.email}</h4>
                        <span className="text-xs text-muted-foreground">Colaborador</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <div 
                          key={perm.key} 
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            getUserPermission(user, perm.key) 
                              ? "bg-primary/5 border-primary/20" 
                              : "bg-secondary/30 border-border/20"
                          }`}
                        >
                          <div className="min-w-0 flex-1 mr-3">
                            <Label htmlFor={`${user.user_id}-${perm.key}`} className="text-xs font-medium cursor-pointer">
                              {perm.label}
                            </Label>
                            <p className="text-[10px] text-muted-foreground truncate">{perm.description}</p>
                          </div>
                          <Switch
                            id={`${user.user_id}-${perm.key}`}
                            checked={getUserPermission(user, perm.key)}
                            onCheckedChange={(checked) => 
                              updatePermission.mutate({ userId: user.user_id, permissionKey: perm.key, isAllowed: checked })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financial">
          <div className="space-y-4">
            <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Taxa de Imposto</h3>
                <p className="text-xs text-muted-foreground">Defina a alíquota de imposto para cálculo do valor líquido</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="max-w-[100px] bg-secondary/30 border-border/30 h-9 text-sm"
                />
                <span className="text-sm text-muted-foreground">%</span>
                <Button onClick={() => updateTaxRate.mutate(parseFloat(taxRate) || 0)} size="sm" className="h-9">
                  Salvar
                </Button>
              </div>
            </div>

            <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Receitas Manuais</h3>
                <p className="text-xs text-muted-foreground">Adicione receitas recebidas fora do sistema</p>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Descrição"
                    value={newRevenueDescription}
                    onChange={(e) => setNewRevenueDescription(e.target.value)}
                    className="flex-1 bg-secondary/30 border-border/30 h-9 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Valor"
                    value={newRevenueAmount}
                    onChange={(e) => setNewRevenueAmount(e.target.value)}
                    className="w-28 bg-secondary/30 border-border/30 h-9 text-sm"
                  />
                  <Button onClick={() => addManualRevenue.mutate({ description: newRevenueDescription, amount: parseFloat(newRevenueAmount) || 0 })} size="sm" className="h-9 w-9 p-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {manualRevenues?.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <span className="text-sm">{r.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">R$ {Number(r.amount).toFixed(2)}</span>
                        <Button variant="ghost" size="sm" onClick={() => deleteManualRevenue.mutate(r.id)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recovery">
          <div className="space-y-4">
            <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Mensagem PIX/Cartão</h3>
                <p className="text-xs text-muted-foreground">Mensagem padrão para recuperação de PIX e cartão pendentes</p>
              </div>
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-lg bg-secondary/30 border border-border/30 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={recoveryMessage}
                  onChange={(e) => setRecoveryMessage(e.target.value)}
                  placeholder="Use {nome}, {primeiro_nome}, {valor}, {saudação}"
                />
                <Button onClick={() => updateRecoveryMessage.mutate(recoveryMessage)} size="sm" className="h-9">
                  Salvar Mensagem
                </Button>
              </div>
            </div>

            <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Webhook Boleto Manual</h3>
                <p className="text-xs text-muted-foreground">URL para geração de boletos manuais</p>
              </div>
              <div className="space-y-3">
                <Input
                  placeholder="https://..."
                  value={boletoWebhook}
                  onChange={(e) => setBoletoWebhook(e.target.value)}
                  className="bg-secondary/30 border-border/30 h-9 text-sm"
                />
                <Button onClick={() => updateBoletoWebhook.mutate(boletoWebhook)} size="sm" className="h-9">
                  Salvar Webhook
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-4">
            {/* WirePusher Settings */}
            <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">WirePusher (Mobile)</h3>
                  <p className="text-xs text-muted-foreground">Notificações push para dispositivos móveis</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
                  <div>
                    <Label className="text-sm font-medium">Ativar WirePusher</Label>
                    <p className="text-xs text-muted-foreground">Enviar notificações para o app WirePusher</p>
                  </div>
                  <Switch
                    checked={wirePusherEnabled}
                    onCheckedChange={setWirePusherEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Device ID</Label>
                  <div className="flex gap-3">
                    <Input
                      placeholder="yLy9mpz45"
                      value={wirePusherDeviceId}
                      onChange={(e) => setWirePusherDeviceId(e.target.value)}
                      className="flex-1 bg-secondary/30 border-border/30 h-9 text-sm"
                    />
                    <Button 
                      onClick={() => updateWirePusherSettings.mutate({ deviceId: wirePusherDeviceId, isEnabled: wirePusherEnabled })}
                      size="sm" 
                      className="h-9"
                    >
                      <Save className="h-3.5 w-3.5 mr-2" />
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Encontre seu Device ID no app WirePusher
                  </p>
                </div>
              </div>
            </div>

            {/* Notification Templates */}
            <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Templates de Notificação</h3>
                <p className="text-xs text-muted-foreground">
                  Personalize as mensagens para cada tipo de evento. Variáveis: {"{nome}"}, {"{primeiro_nome}"}, {"{valor}"}, {"{tipo}"}
                </p>
              </div>
              
              <div className="space-y-3">
                {Object.values(editedTemplates).map((template) => (
                  <div key={template.id} className="p-4 rounded-lg bg-secondary/20 border border-border/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {EVENT_TYPE_LABELS[template.event_type] || template.event_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={(checked) => handleTemplateChange(template.id, "is_active", checked)}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => saveTemplate(template.id)}
                          className="h-8"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Título</Label>
                        <Input
                          value={template.title}
                          onChange={(e) => handleTemplateChange(template.id, "title", e.target.value)}
                          className="bg-secondary/30 border-border/30 h-8 text-sm"
                          disabled={!template.is_active}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Mensagem</Label>
                        <Input
                          value={template.message}
                          onChange={(e) => handleTemplateChange(template.id, "message", e.target.value)}
                          className="bg-secondary/30 border-border/30 h-8 text-sm"
                          disabled={!template.is_active}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Tipo (WirePusher)</Label>
                        <Input
                          value={template.notification_type}
                          onChange={(e) => handleTemplateChange(template.id, "notification_type", e.target.value)}
                          className="bg-secondary/30 border-border/30 h-8 text-sm"
                          disabled={!template.is_active}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksSection />
        </TabsContent>

        <TabsContent value="data">
          <DataImportExport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;