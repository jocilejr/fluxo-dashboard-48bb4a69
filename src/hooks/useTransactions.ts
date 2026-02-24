import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  id: string;
  external_id: string | null;
  type: "boleto" | "pix" | "cartao";
  status: "gerado" | "pago" | "pendente" | "cancelado" | "expirado";
  amount: number;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  created_at: string;
  paid_at: string | null;
  metadata: { boleto_url?: string } | null;
}

export interface TransactionStats {
  boletosGerados: number;
  boletosPagos: number;
  pixGerado: number;
  pixPago: number;
  pedidosCartao: number;
  volumeCartao: number;
}

export interface TransactionNotification {
  id: string;
  type: "boleto" | "pix" | "cartao";
  status: "gerado" | "pago" | "pendente";
  customerName: string;
  amount: number;
  timestamp: Date;
}

interface UseTransactionsOptions {
  startDate?: Date;
  endDate?: Date;
}

export function useTransactions(options?: UseTransactionsOptions) {
  const { data: transactions, refetch, isLoading } = useQuery({
    queryKey: ["transactions", options?.startDate?.toISOString(), options?.endDate?.toISOString()],
    staleTime: 30000,
    gcTime: 300000,
    queryFn: async () => {
      const allTransactions: Transaction[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allTransactions.push(...(data as Transaction[]));
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allTransactions;
    },
  });

  const stats: TransactionStats = {
    boletosGerados: transactions?.filter((t) => t.type === "boleto").length || 0,
    boletosPagos: transactions?.filter((t) => t.type === "boleto" && t.status === "pago").length || 0,
    pixGerado: transactions?.filter((t) => t.type === "pix").length || 0,
    pixPago: transactions?.filter((t) => t.type === "pix" && t.status === "pago").length || 0,
    pedidosCartao: transactions?.filter((t) => t.type === "cartao").length || 0,
    volumeCartao: transactions?.filter((t) => t.type === "cartao" && t.status === "pago")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
  };

  return {
    transactions: transactions || [],
    stats,
    isLoading,
    refetch,
  };
}
