import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, Loader2, CreditCard, Users, ShoppingCart, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function WebhookUrlCard({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 bg-secondary/20 rounded-lg border border-border/30">
      <label className="text-xs text-muted-foreground mb-2 block">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-background/50 px-3 py-2 rounded text-xs break-all border border-border/20 font-mono">
          {url}
        </code>
        <Button variant="outline" size="icon" onClick={copyToClipboard} className="h-9 w-9 shrink-0">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function PayloadExample({ title, payload, defaultOpen = false }: { title: string; payload: object; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3 bg-secondary/10 hover:bg-secondary/20 transition-colors text-left"
      >
        <span className="text-xs font-medium">{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <pre className="bg-secondary/30 p-3 text-xs overflow-x-auto border-x border-b border-border/20 font-mono">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Transações Webhook
function TransacoesWebhook() {
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-receiver`;

  const examplePayload = {
    event: "payment.created",
    type: "boleto",
    external_id: "23793.38128 60000.000003 00000.000408 1 84340000012345",
    amount: 123.45,
    status: "gerado",
    customer_name: "João Silva",
    customer_phone: "11999999999",
    customer_email: "joao@email.com",
    boleto_url: "https://exemplo.com/boleto/123.pdf"
  };

  const exampleUpdatePayload = {
    event: "payment.paid",
    type: "boleto",
    external_id: "23793.38128 60000.000003 00000.000408 1 84340000012345",
    status: "pago"
  };

  return (
    <div className="space-y-4">
      <WebhookUrlCard url={webhookUrl} label="URL do Webhook" />

      <div className="space-y-2">
        <PayloadExample title="Criar Transação" payload={examplePayload} defaultOpen />
        <PayloadExample title="Atualizar Status (Boleto Pago)" payload={exampleUpdatePayload} />
      </div>

      <div className="p-4 bg-info/5 border border-info/20 rounded-lg">
        <h5 className="text-xs font-semibold text-info mb-2">Campos Aceitos</h5>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Obrigatórios:</strong> type (boleto, pix, cartao), amount</p>
          <p><strong>Cliente:</strong> customer_name, customer_phone, customer_email, customer_document</p>
          <p><strong>Boleto:</strong> boleto_url, external_id (código de barras)</p>
          <p><strong>Status:</strong> gerado, pago, pendente, cancelado, expirado</p>
        </div>
      </div>
    </div>
  );
}

// Grupos Webhook
function GruposWebhook() {
  const queryClient = useQueryClient();
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-groups`;

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo removido");
      queryClient.invalidateQueries({ queryKey: ["groups-settings"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: () => {
      toast.error("Erro ao remover grupo");
    },
  });

  return (
    <div className="space-y-4">
      <WebhookUrlCard url={webhookUrl} label="URL do Webhook" />

      {/* Groups List */}
      <div className="p-4 bg-secondary/20 rounded-lg border border-border/30">
        <h5 className="text-xs font-semibold mb-3">Grupos Cadastrados</h5>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups && groups.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/20">
                <div>
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.current_members} membros • +{group.total_entries} / -{group.total_exits}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteGroup.mutate(group.id)}
                  disabled={deleteGroup.isPending}
                  className="h-7 w-7"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum grupo cadastrado. Criados automaticamente via webhook.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <PayloadExample 
          title="Atualização Única" 
          payload={{ 
            whatsapp_id: "120363402024543243@g.us",
            name: "Comunidade de Orações #13",
            current_members: 814,
            entries: 5,
            exits: 2
          }} 
          defaultOpen 
        />
        <PayloadExample 
          title="Atualização em Lote (batch)" 
          payload={{ 
            batch: true,
            groups: [
              { whatsapp_id: "120363...", name: "Grupo 1", current_members: 500, entries: 10, exits: 3 },
              { whatsapp_id: "120364...", name: "Grupo 2", current_members: 300, entries: 5, exits: 1 }
            ]
          }} 
        />
      </div>

      <div className="p-4 bg-info/5 border border-info/20 rounded-lg">
        <h5 className="text-xs font-semibold text-info mb-2">Campos Aceitos</h5>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Identificação:</strong> whatsapp_id (ID único) ou name (nome do grupo)</p>
          <p><strong>Estatísticas:</strong> current_members, entries (total entradas), exits (total saídas)</p>
          <p><strong>Lote:</strong> batch: true + groups: [...] para múltiplos grupos</p>
        </div>
      </div>
    </div>
  );
}

// Abandono/Falha Webhook
function AbandonoWebhook() {
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-abandoned`;

  const exampleCartPayload = {
    event_type: "cart_abandoned",
    customer_name: "João Silva",
    customer_phone: "11999998888",
    customer_email: "joao@email.com",
    amount: 197.00,
    product_name: "Curso de Marketing Digital",
    funnel_stage: "checkout",
    utm_source: "instagram",
    utm_campaign: "black_friday"
  };

  const exampleFailedPayload = {
    event_type: "boleto_failed",
    customer_name: "Maria Santos",
    customer_phone: "11888887777",
    amount: 497.00,
    product_name: "Mentoria Premium",
    error_message: "CPF inválido"
  };

  return (
    <div className="space-y-4">
      <WebhookUrlCard url={webhookUrl} label="URL do Webhook" />

      <div className="space-y-2">
        <PayloadExample title="Carrinho Abandonado" payload={exampleCartPayload} defaultOpen />
        <PayloadExample title="Falha no Boleto" payload={exampleFailedPayload} />
      </div>

      <div className="p-4 bg-info/5 border border-info/20 rounded-lg">
        <h5 className="text-xs font-semibold text-info mb-2">Campos Aceitos (nenhum obrigatório)</h5>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Tipo:</strong> event_type ("cart_abandoned" ou "boleto_failed")</p>
          <p><strong>Cliente:</strong> customer_name, customer_phone, customer_email, customer_document</p>
          <p><strong>Produto:</strong> amount, product_name, funnel_stage</p>
          <p><strong>UTM:</strong> utm_source, utm_medium, utm_campaign, utm_term, utm_content</p>
          <p><strong>Erro:</strong> error_message (para falhas)</p>
        </div>
      </div>
    </div>
  );
}

// API Externa (Mensagens) Webhook
function MensagensWebhook() {
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-messaging-webhook`;

  const reminderPayload = {
    event: "reminder_updated",
    id: "uuid-do-lembrete",
    completed: true,
    title: "Cobrar João",
    due_date: "2026-03-30T10:00:00Z"
  };

  const reminderCreatePayload = {
    event: "sync_reminder",
    id: "uuid-do-lembrete",
    title: "Novo lembrete",
    description: "Descrição do lembrete",
    due_date: "2026-04-01T10:00:00Z",
    completed: false
  };

  const reminderDeletePayload = {
    event: "reminder_deleted",
    id: "uuid-do-lembrete"
  };

  const usefulLinkPayload = {
    event: "useful_link_created",
    title: "Meu Link Útil",
    url: "https://exemplo.com",
    description: "Descrição do link",
    icon: "🔗",
    is_active: true
  };

  const usefulLinkDeletePayload = {
    event: "useful_link_deleted",
    url: "https://exemplo.com"
  };

  return (
    <div className="space-y-4">
      <WebhookUrlCard url={webhookUrl} label="URL do Webhook (API Externa)" />

      <div className="space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground">Lembretes</h5>
        <PayloadExample title="Criar/Atualizar Lembrete (sync_reminder)" payload={reminderCreatePayload} defaultOpen />
        <PayloadExample title="Marcar como Concluído (reminder_updated)" payload={reminderPayload} />
        <PayloadExample title="Excluir Lembrete (reminder_deleted)" payload={reminderDeletePayload} />
      </div>

      <div className="space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground">Links Úteis</h5>
        <PayloadExample title="Criar/Atualizar Link (useful_link_created)" payload={usefulLinkPayload} />
        <PayloadExample title="Excluir Link (useful_link_deleted)" payload={usefulLinkDeletePayload} />
      </div>

      <div className="p-4 bg-info/5 border border-info/20 rounded-lg">
        <h5 className="text-xs font-semibold text-info mb-2">Eventos de Entrada (Externa → Dashboard)</h5>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Lembretes:</strong> sync_reminder, reminder_updated, reminder_deleted</p>
          <p><strong>Links Úteis:</strong> useful_link_created, useful_link_updated, useful_link_deleted</p>
          <p><strong>Pagamentos:</strong> payment_confirmed, payment_failed, payment_refunded, invoice_created</p>
          <p><strong>Clientes:</strong> customer_updated, sync_customer</p>
          <p><strong>Outros:</strong> sync_transaction, sync_abandoned_event, bulk_sync</p>
        </div>
      </div>

      <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
        <h5 className="text-xs font-semibold text-green-600 mb-2">Eventos de Saída (Dashboard → Externa)</h5>
        <p className="text-[10px] text-muted-foreground mb-2">
          Configure a <strong>Webhook URL</strong> em Configurações → API para receber estes eventos automaticamente.
        </p>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Lembretes:</strong> reminder_created, reminder_updated, reminder_deleted</p>
        </div>
      </div>
    </div>
  );
}

export function WebhooksSection() {
  return (
    <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-foreground">Configuração de Webhooks</h3>
        <p className="text-xs text-muted-foreground">URLs para integração com sistemas externos</p>
      </div>

      <Tabs defaultValue="mensagens" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="mensagens" className="gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mensagens</span>
          </TabsTrigger>
          <TabsTrigger value="transacoes" className="gap-1.5 text-xs">
            <CreditCard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Transações</span>
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Grupos</span>
          </TabsTrigger>
          <TabsTrigger value="abandono" className="gap-1.5 text-xs">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abandono</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mensagens">
          <MensagensWebhook />
        </TabsContent>

        <TabsContent value="transacoes">
          <TransacoesWebhook />
        </TabsContent>

        <TabsContent value="grupos">
          <GruposWebhook />
        </TabsContent>

        <TabsContent value="abandono">
          <AbandonoWebhook />
        </TabsContent>
      </Tabs>
    </div>
  );
}
