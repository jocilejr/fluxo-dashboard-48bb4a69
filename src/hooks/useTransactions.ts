import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

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
  normalized_phone?: string | null;
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

function getBrazilToday() {
  const brazilDateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const brazilNow = new Date(brazilDateStr);
  return { start: startOfDay(brazilNow), end: endOfDay(brazilNow) };
}

export function useTransactions(options?: UseTransactionsOptions) {
  // Stable default: today in Brazil timezone, memoized to avoid queryKey churn
  const stableToday = useMemo(() => getBrazilToday(), []);
  const effectiveStart = options?.startDate || stableToday.start;
  const effectiveEnd = options?.endDate || stableToday.end;
  const hasDateFilter = !!(options?.startDate || options?.endDate);

  const { data: transactions, refetch, isLoading } = useQuery({
    queryKey: ["transactions", effectiveStart.toISOString(), effectiveEnd.toISOString()],
    staleTime: 30000,
    gcTime: 300000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false, // Realtime handles updates; avoid heavy refetch on focus
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async () => {
      const startISO = effectiveStart.toISOString();
      const endISO = effectiveEnd.toISOString();

      // Use OR filter: include transactions created in period OR paid in period
      const dateFilter = `and(created_at.gte.${startISO},created_at.lte.${endISO}),and(paid_at.gte.${startISO},paid_at.lte.${endISO})`;

      // Only paginate when fetching large historical ranges
      if (hasDateFilter) {
        const allTransactions: Transaction[] = [];
        const pageSize = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .or(dateFilter)
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
      }

      // Default path: single fast query (max 1000)
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or(dateFilter)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data as Transaction[]) || [];
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
