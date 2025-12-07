import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneForMatching, generatePhoneVariations } from "@/lib/phoneNormalization";

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
  pix_payment_count: number;
  // Merged data from multiple phone variations
  merged_phones?: string[];
}

export interface CustomerEvent {
  id: string;
  type: "transaction" | "abandoned" | "pix_link";
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
  original_phone?: string; // Track which phone variation this came from
}

export interface CustomerStats {
  boleto: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  pix: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  cartao: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  abandoned: { count: number; totalAmount: number };
}

// Merge multiple customer records that have the same normalized phone
function mergeCustomerRecords(customers: Customer[]): Customer[] {
  const phoneGroups = new Map<string, Customer[]>();
  
  // Group by normalized phone
  for (const customer of customers) {
    const normalizedKey = normalizePhoneForMatching(customer.normalized_phone);
    if (!normalizedKey) continue;
    
    const existing = phoneGroups.get(normalizedKey);
    if (existing) {
      existing.push(customer);
    } else {
      phoneGroups.set(normalizedKey, [customer]);
    }
  }
  
  // Merge each group into a single customer
  const mergedCustomers: Customer[] = [];
  
  for (const [normalizedKey, group] of phoneGroups) {
    if (group.length === 1) {
      mergedCustomers.push({
        ...group[0],
        merged_phones: [group[0].normalized_phone]
      });
    } else {
      // Sort by last_seen_at to get most recent info
      group.sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
      const primary = group[0];
      
      // Merge data from all records
      const merged: Customer = {
        ...primary,
        // Use most recent name/email/document if primary doesn't have it
        name: primary.name || group.find(c => c.name)?.name || null,
        email: primary.email || group.find(c => c.email)?.email || null,
        document: primary.document || group.find(c => c.document)?.document || null,
        display_phone: primary.display_phone || group.find(c => c.display_phone)?.display_phone || null,
        // Get earliest first_seen
        first_seen_at: group.reduce((earliest, c) => 
          new Date(c.first_seen_at) < new Date(earliest) ? c.first_seen_at : earliest
        , primary.first_seen_at),
        // Sum up all totals
        total_transactions: group.reduce((sum, c) => sum + c.total_transactions, 0),
        total_paid: group.reduce((sum, c) => sum + Number(c.total_paid), 0),
        total_pending: group.reduce((sum, c) => sum + Number(c.total_pending), 0),
        total_abandoned_events: group.reduce((sum, c) => sum + c.total_abandoned_events, 0),
        pix_payment_count: group.reduce((sum, c) => sum + c.pix_payment_count, 0),
        // Track all phone variations
        merged_phones: group.map(c => c.normalized_phone)
      };
      
      mergedCustomers.push(merged);
    }
  }
  
  return mergedCustomers;
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
      
      // Merge customers with the same normalized phone
      const merged = mergeCustomerRecords(data as Customer[]);
      
      // Sort by total_paid descending
      merged.sort((a, b) => Number(b.total_paid) - Number(a.total_paid));
      
      return merged;
    },
  });

  return { customers, isLoading, refetch };
}

// Buscar métodos de pagamento por cliente (para filtros)
export function useCustomerPaymentMethods() {
  const { data = {}, isLoading } = useQuery({
    queryKey: ["customer-payment-methods"],
    queryFn: async () => {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("normalized_phone, type")
        .not("normalized_phone", "is", null);

      if (error) throw error;

      // Agrupar por telefone normalizado (using our normalization)
      const methodsByPhone: Record<string, Set<string>> = {};
      (transactions || []).forEach((t) => {
        if (!t.normalized_phone) return;
        const normalizedKey = normalizePhoneForMatching(t.normalized_phone) || t.normalized_phone;
        if (!methodsByPhone[normalizedKey]) {
          methodsByPhone[normalizedKey] = new Set();
        }
        methodsByPhone[normalizedKey].add(t.type);
      });

      // Converter Sets para arrays
      const result: Record<string, string[]> = {};
      Object.entries(methodsByPhone).forEach(([phone, methods]) => {
        result[phone] = Array.from(methods);
      });

      return result;
    },
  });

  return { paymentMethodsByPhone: data, isLoading };
}

export function useCustomerEvents(normalizedPhone: string | null, mergedPhones?: string[]) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-events", normalizedPhone, mergedPhones],
    enabled: !!normalizedPhone,
    queryFn: async () => {
      if (!normalizedPhone) return { events: [], stats: null };

      // Get all phone variations to search for
      const phonesToSearch = mergedPhones && mergedPhones.length > 0 
        ? mergedPhones 
        : generatePhoneVariations(normalizedPhone);
      
      // Also include the original normalized phone
      if (!phonesToSearch.includes(normalizedPhone)) {
        phonesToSearch.push(normalizedPhone);
      }

      // Fetch transactions for all phone variations
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("id, type, status, amount, description, created_at, paid_at, external_id, normalized_phone")
        .in("normalized_phone", phonesToSearch)
        .order("created_at", { ascending: false });

      if (txError) throw txError;

      // Fetch abandoned events for all phone variations
      const { data: abandonedEvents, error: abError } = await supabase
        .from("abandoned_events")
        .select("id, event_type, amount, product_name, error_message, created_at, normalized_phone")
        .in("normalized_phone", phonesToSearch)
        .order("created_at", { ascending: false });

      if (abError) throw abError;

      // Fetch PIX link generations for all phone variations
      const { data: pixLinks, error: pixError } = await supabase
        .from("delivery_link_generations")
        .select("id, created_at, product_id, payment_method, normalized_phone")
        .in("normalized_phone", phonesToSearch)
        .eq("payment_method", "pix")
        .order("created_at", { ascending: false });

      if (pixError) throw pixError;

      // Fetch product info for PIX links
      const productIds = [...new Set((pixLinks || []).map(p => p.product_id))];
      let productsMap: Record<string, { name: string; value: number }> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("delivery_products")
          .select("id, name, value")
          .in("id", productIds);
        
        (products || []).forEach(p => {
          productsMap[p.id] = { name: p.name, value: p.value || 0 };
        });
      }

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

      // Add PIX links to stats as paid PIX
      (pixLinks || []).forEach((p) => {
        const product = productsMap[p.product_id];
        stats.pix.count++;
        stats.pix.paid++;
        stats.pix.totalPaid += product?.value || 0;
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
          original_phone: t.normalized_phone,
        })),
        ...(pixLinks || []).map((p) => ({
          id: p.id,
          type: "pix_link" as const,
          transaction_type: "pix" as const,
          status: "pago",
          amount: productsMap[p.product_id]?.value || 0,
          description: productsMap[p.product_id]?.name || "Produto",
          product_name: productsMap[p.product_id]?.name,
          created_at: p.created_at,
          paid_at: p.created_at,
          original_phone: p.normalized_phone,
        })),
        ...(abandonedEvents || []).map((a) => ({
          id: a.id,
          type: "abandoned" as const,
          event_type: a.event_type,
          amount: a.amount,
          product_name: a.product_name,
          error_message: a.error_message,
          created_at: a.created_at,
          original_phone: a.normalized_phone,
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
