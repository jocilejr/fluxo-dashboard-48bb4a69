import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Copy, Plus, ChevronDown, Link, ShoppingBag, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface MemberProduct {
  id: string;
  normalized_phone: string;
  is_active: boolean;
  delivery_products: { name: string } | null;
}

interface Props {
  phone: string;
  products: MemberProduct[];
  customerName: string | null;
  onDeleteProduct: (id: string) => void;
  onAddProduct: (phone: string) => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pago: { label: "Pago", variant: "default" },
  gerado: { label: "Gerado", variant: "outline" },
  pendente: { label: "Pendente", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "destructive" },
};

export default function MemberClientCard({ phone, products, customerName, onDeleteProduct, onAddProduct }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const memberUrl = `${window.location.origin}/membros/${phone}`;

  const copyLink = () => {
    navigator.clipboard.writeText(memberUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["member-transactions", phone],
    queryFn: async () => {
      const variations = generatePhoneVariations(phone);
      if (!variations.length) return [];
      const { data } = await supabase
        .from("transactions")
        .select("id, description, amount, status, type, created_at, paid_at")
        .in("normalized_phone", variations)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: historyOpen,
  });

  const hasActiveProduct = products.some((p) => p.is_active);
  const initials = customerName ? customerName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "?";

  return (
    <Card className="overflow-hidden border-l-2 transition-shadow hover:shadow-md" style={{ borderLeftColor: hasActiveProduct ? "hsl(var(--primary))" : "hsl(var(--border))" }}>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{customerName || "Cliente sem nome"}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs text-muted-foreground">{phone}</span>
                <Badge variant={hasActiveProduct ? "default" : "secondary"} className="text-[10px] h-5">
                  {hasActiveProduct ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Copy link popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs gap-1.5">
                <Link className="h-3.5 w-3.5" /> Link
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              <p className="text-xs font-medium text-muted-foreground mb-2">Link de acesso do membro</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 truncate border border-border font-mono text-foreground">
                  {memberUrl}
                </code>
                <Button size="sm" className="shrink-0 h-8 px-3" onClick={copyLink}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Products */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Produtos liberados</p>
          <div className="flex flex-wrap gap-2">
            {products.map((mp) => (
              <div key={mp.id} className="flex items-center gap-1.5 bg-muted border border-border rounded-md px-3 py-1.5">
                <span className="text-xs text-foreground">{mp.delivery_products?.name || "Removido"}</span>
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  onClick={() => onDeleteProduct(mp.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-3 py-1.5 transition-colors hover:bg-muted"
              onClick={() => onAddProduct(phone)}
            >
              <Plus className="h-3 w-3" /> Liberar
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors pt-3 border-t border-border">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" /> Histórico de Compras
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {loadingTx ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : !transactions?.length ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma transação encontrada</p>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx: any) => {
                  const st = statusMap[tx.status] || { label: tx.status, variant: "outline" as const };
                  const date = tx.paid_at || tx.created_at;
                  return (
                    <div key={tx.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-3 py-2 border border-border/50">
                      <span className="truncate flex-1 mr-2 text-foreground">{tx.description || "Sem descrição"}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-foreground">R$ {Number(tx.amount).toFixed(2).replace(".", ",")}</span>
                        <Badge variant={st.variant} className="text-[10px]">
                          {st.label}
                        </Badge>
                        <span className="text-muted-foreground">{format(new Date(date), "dd/MM", { locale: ptBR })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
