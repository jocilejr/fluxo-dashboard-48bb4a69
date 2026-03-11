import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Copy, Plus, ChevronDown, Link, User, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const memberUrl = `${window.location.origin}/membros/${phone}`;

  const copyLink = () => {
    navigator.clipboard.writeText(memberUrl);
    toast.success("Link copiado!");
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

  return (
    <Card className="p-4 space-y-3">
      {/* Header: Name + Phone */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold truncate">
              {customerName || "Cliente sem nome"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm text-muted-foreground">{phone}</span>
            <Badge variant={hasActiveProduct ? "default" : "secondary"}>
              {hasActiveProduct ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
      </div>

      {/* URL */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
        <Link className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm truncate flex-1 text-muted-foreground">{memberUrl}</span>
        <Button variant="ghost" size="sm" onClick={copyLink} className="shrink-0 h-7 px-2">
          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
        </Button>
      </div>

      {/* Products */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Produtos liberados</p>
        {products.map((mp) => (
          <div key={mp.id} className="flex items-center justify-between pl-2">
            <span className="text-sm">• {mp.delivery_products?.name || "Produto removido"}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onDeleteProduct(mp.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="mt-1" onClick={() => onAddProduct(phone)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Liberar outro produto
        </Button>
      </div>

      {/* Transaction History */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> Histórico de Compras
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {loadingTx ? (
            <p className="text-sm text-muted-foreground text-center py-3">Carregando...</p>
          ) : !transactions?.length ? (
            <p className="text-sm text-muted-foreground text-center py-3">Nenhuma transação encontrada</p>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx: any) => {
                const st = statusMap[tx.status] || { label: tx.status, variant: "outline" as const };
                const date = tx.paid_at || tx.created_at;
                return (
                  <div key={tx.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-1.5">
                    <span className="truncate flex-1 mr-2">{tx.description || "Sem descrição"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono">R$ {Number(tx.amount).toFixed(2).replace(".", ",")}</span>
                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(date), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
