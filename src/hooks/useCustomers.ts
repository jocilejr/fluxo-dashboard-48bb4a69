import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Customer {
  id: string;
  normalized_phone: string;
  display_phone: string | null;
  name: string | null;
  email: string | null;
  document: string | null;
  first_seen_at: string;
  last_seen_at: string;
  total_transactions: number;
  total_paid: number;
  total_pending: number;
  total_abandoned_events: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerEvent {
  id: string;
  type: "transaction" | "abandoned";
  event_type?: string;
  status?: string;
  transaction_type?: "boleto" | "pix" | "cartao";
  amount: number | null;
  description?: string | null;
  product_name?: string | null;
  error_message?: string | null;
  created_at: string;
  paid_at?: string | null;
  external_id?: string | null;
}

export interface CustomerStats {
  boleto: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  pix: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  cartao: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  abandoned: { count: number; totalAmount: number };
}

export function useCustomers() {
  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("last_seen_at", { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
  });

  return { customers, isLoading, refetch };
}

export function useCustomerEvents(normalizedPhone: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-events", normalizedPhone],
    enabled: !!normalizedPhone,
    queryFn: async () => {
      if (!normalizedPhone) return { events: [], stats: null };

      // Fetch transactions with full details
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("id, type, status, amount, description, created_at, paid_at, external_id")
        .eq("normalized_phone", normalizedPhone)
        .order("created_at", { ascending: false });

      if (txError) throw txError;

      // Fetch abandoned events
      const { data: abandonedEvents, error: abError } = await supabase
        .from("abandoned_events")
        .select("id, event_type, amount, product_name, error_message, created_at")
        .eq("normalized_phone", normalizedPhone)
        .order("created_at", { ascending: false });

      if (abError) throw abError;

      // Calculate stats by payment method
      const stats: CustomerStats = {
        boleto: { count: 0, paid: 0, pending: 0, totalPaid: 0, totalPending: 0 },
        pix: { count: 0, paid: 0, pending: 0, totalPaid: 0, totalPending: 0 },
        cartao: { count: 0, paid: 0, pending: 0, totalPaid: 0, totalPending: 0 },
        abandoned: { count: abandonedEvents?.length || 0, totalAmount: 0 },
      };

      (transactions || []).forEach((t) => {
        const method = t.type as "boleto" | "pix" | "cartao";
        if (stats[method]) {
          stats[method].count++;
          if (t.status === "pago") {
            stats[method].paid++;
            stats[method].totalPaid += Number(t.amount) || 0;
          } else if (t.status === "pendente" || t.status === "gerado") {
            stats[method].pending++;
            stats[method].totalPending += Number(t.amount) || 0;
          }
        }
      });

      (abandonedEvents || []).forEach((a) => {
        stats.abandoned.totalAmount += Number(a.amount) || 0;
      });

      // Combine and sort
      const allEvents: CustomerEvent[] = [
        ...(transactions || []).map((t) => ({
          id: t.id,
          type: "transaction" as const,
          transaction_type: t.type as "boleto" | "pix" | "cartao",
          status: t.status,
          amount: t.amount,
          description: t.description,
          created_at: t.created_at,
          paid_at: t.paid_at,
          external_id: t.external_id,
        })),
        ...(abandonedEvents || []).map((a) => ({
          id: a.id,
          type: "abandoned" as const,
          event_type: a.event_type,
          amount: a.amount,
          product_name: a.product_name,
          error_message: a.error_message,
          created_at: a.created_at,
        })),
      ];

      // Sort by date descending
      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { events: allEvents, stats };
    },
  });

  return { 
    events: data?.events || [], 
    stats: data?.stats || null, 
    isLoading 
  };
}

export async function refreshCustomerStats(normalizedPhone?: string) {
  const { error } = await supabase.rpc("refresh_customer_stats", {
    customer_normalized_phone: normalizedPhone || null,
  });
  if (error) throw error;
}
