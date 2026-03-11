import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Copy, Plus, ChevronDown, Link, ShoppingBag } from "lucide-react";
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

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pago: { label: "Pago", variant: "default", color: "#22c55e" },
  gerado: { label: "Gerado", variant: "outline", color: "#6b7280" },
  pendente: { label: "Pendente", variant: "secondary", color: "#f59e0b" },
  cancelado: { label: "Cancelado", variant: "destructive", color: "#ef4444" },
  expirado: { label: "Expirado", variant: "destructive", color: "#ef4444" },
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
  const initials = customerName ? customerName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "?";

  return (
    <Card className="overflow-hidden border-l-4 transition-shadow hover:shadow-md" style={{ borderLeftColor: hasActiveProduct ? "#22c55e" : "#d1d5db" }}>
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{customerName || "Cliente sem nome"}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs text-gray-500">{phone}</span>
              <Badge variant={hasActiveProduct ? "default" : "secondary"} className="text-[10px] h-5">
                {hasActiveProduct ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>

        {/* URL */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
          <Link className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-xs truncate flex-1 text-gray-500 font-mono">{memberUrl}</span>
          <Button variant="ghost" size="sm" onClick={copyLink} className="shrink-0 h-7 px-2.5 text-xs font-semibold hover:bg-gray-200/50">
            <Copy className="h-3 w-3 mr-1" /> Copiar
          </Button>
        </div>

        {/* Products as chips */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Produtos liberados</p>
          <div className="flex flex-wrap gap-2">
            {products.map((mp) => (
              <div key={mp.id} className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium text-gray-700">{mp.delivery_products?.name || "Removido"}</span>
                <button
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  onClick={() => onDeleteProduct(mp.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 border border-dashed border-primary/30 rounded-lg px-3 py-1.5 transition-colors hover:bg-primary/5"
              onClick={() => onAddProduct(phone)}
            >
              <Plus className="h-3 w-3" /> Liberar
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 transition-colors pt-1 border-t border-gray-100 mt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <ShoppingBag className="h-3.5 w-3.5" /> Histórico de Compras
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {loadingTx ? (
              <p className="text-xs text-gray-400 text-center py-4">Carregando...</p>
            ) : !transactions?.length ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhuma transação encontrada</p>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx: any) => {
                  const st = statusMap[tx.status] || { label: tx.status, variant: "outline" as const, color: "#6b7280" };
                  const date = tx.paid_at || tx.created_at;
                  return (
                    <div key={tx.id} className="flex items-center justify-between text-xs bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-100/50">
                      <span className="truncate flex-1 mr-2 text-gray-700">{tx.description || "Sem descrição"}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-gray-800">R$ {Number(tx.amount).toFixed(2).replace(".", ",")}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${st.color}15`, color: st.color }}>
                          {st.label}
                        </span>
                        <span className="text-gray-400">{format(new Date(date), "dd/MM", { locale: ptBR })}</span>
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
