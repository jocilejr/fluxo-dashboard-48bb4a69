import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneForMatching, generatePhoneVariations } from "@/lib/phoneNormalization";
import { toast } from "sonner";
import { addActivityLog } from "@/components/settings/ActivityLogs";

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
  merged_phones?: string[];
}

export interface CustomerEvent {
  id: string;
  type: "transaction" | "abandoned" | "pix_link" | "delivery_access";
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
  original_phone?: string;
}

export interface CustomerStats {
  boleto: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  pix: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  cartao: { count: number; paid: number; pending: number; totalPaid: number; totalPending: number };
  abandoned: { count: number; totalAmount: number };
  deliveryAccesses: number;
}

function mergeCustomerRecords(customers: Customer[]): Customer[] {
  const phoneGroups = new Map<string, Customer[]>();
  
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
  
  const mergedCustomers: Customer[] = [];
  
  for (const [, group] of phoneGroups) {
    if (group.length === 1) {
      mergedCustomers.push({
        ...group[0],
        merged_phones: [group[0].normalized_phone]
      });
    } else {
      group.sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
      const primary = group[0];
      
      const merged: Customer = {
        ...primary,
        name: primary.name || group.find(c => c.name)?.name || null,
        email: primary.email || group.find(c => c.email)?.email || null,
        document: primary.document || group.find(c => c.document)?.document || null,
        display_phone: primary.display_phone || group.find(c => c.display_phone)?.display_phone || null,
        first_seen_at: group.reduce((earliest, c) => 
          new Date(c.first_seen_at) < new Date(earliest) ? c.first_seen_at : earliest
        , primary.first_seen_at),
        total_transactions: group.reduce((sum, c) => sum + c.total_transactions, 0),
        total_paid: group.reduce((sum, c) => sum + Number(c.total_paid), 0),
        total_pending: group.reduce((sum, c) => sum + Number(c.total_pending), 0),
        total_abandoned_events: group.reduce((sum, c) => sum + c.total_abandoned_events, 0),
        pix_payment_count: group.reduce((sum, c) => sum + c.pix_payment_count, 0),
        merged_phones: group.map(c => c.normalized_phone)
      };
      
      mergedCustomers.push(merged);
    }
  }
  
  return mergedCustomers;
}

export function useCustomers() {
  const queryClient = useQueryClient();
  
  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("last_seen_at", { ascending: false });

      if (error) throw error;
      
      const merged = mergeCustomerRecords(data as Customer[]);
      merged.sort((a, b) => Number(b.total_paid) - Number(a.total_paid));
      
      return merged;
    },
  });

  const updateCustomer = async (customerId: string, updates: { name?: string; email?: string; document?: string }) => {
    // Get customer to find normalized_phone
    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("normalized_phone, merged_phones:normalized_phone")
      .eq("id", customerId)
      .single();
    
    if (fetchError) {
      toast.error("Erro ao buscar cliente");
      addActivityLog({ type: "error", category: "Clientes", message: "Erro ao buscar cliente", details: fetchError.message });
      throw fetchError;
    }

    // Update customer record
    const { error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", customerId);
    
    if (error) {
      toast.error("Erro ao atualizar cliente");
      addActivityLog({ type: "error", category: "Clientes", message: "Erro ao atualizar cliente", details: error.message });
      throw error;
    }
    
    // If name was updated, also update transactions table for sync
    if (updates.name !== undefined && customer?.normalized_phone) {
      const phoneVariations = generatePhoneVariations(customer.normalized_phone);
      
      // Update customer_name in transactions table
      await supabase
        .from("transactions")
        .update({ customer_name: updates.name })
        .in("normalized_phone", phoneVariations);
      
      // Update customer_name in abandoned_events table
      await supabase
        .from("abandoned_events")
        .update({ customer_name: updates.name })
        .in("normalized_phone", phoneVariations);
    }
    
    toast.success("Cliente atualizado");
    addActivityLog({ 
      type: "success", 
      category: "Clientes", 
      message: `Cliente atualizado: ${updates.name || customer?.normalized_phone}`,
      details: JSON.stringify(updates)
    });
    
    // Invalidate all related queries for real-time update across all tabs
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-events"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["abandonedEvents"] }),
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-contacts"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-payment-methods"] }),
    ]);
  };

  const deleteTransaction = async (transactionId: string) => {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId);
    
    if (error) {
      toast.error("Erro ao excluir transação");
      addActivityLog({ type: "error", category: "Transações", message: "Erro ao excluir transação", details: error.message });
      throw error;
    }
    
    toast.success("Transação excluída");
    addActivityLog({ type: "action", category: "Transações", message: `Transação excluída: ${transactionId}` });
    
    // Invalidate all related queries for real-time update
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-events"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-contacts"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-payment-methods"] }),
    ]);
  };

  const deleteAbandonedEvent = async (eventId: string) => {
    const { error } = await supabase
      .from("abandoned_events")
      .delete()
      .eq("id", eventId);
    
    if (error) {
      toast.error("Erro ao excluir evento");
      addActivityLog({ type: "error", category: "Abandonos", message: "Erro ao excluir evento abandonado", details: error.message });
      throw error;
    }
    
    toast.success("Evento excluído");
    addActivityLog({ type: "action", category: "Abandonos", message: `Evento abandonado excluído: ${eventId}` });
    
    // Invalidate all related queries for real-time update
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-events"] }),
      queryClient.invalidateQueries({ queryKey: ["abandonedEvents"] }),
    ]);
  };

  const deleteCustomerWithData = async (customerId: string, normalizedPhone: string, mergedPhones?: string[]) => {
    // Generate all phone variations to delete associated data
    const basePhones = mergedPhones && mergedPhones.length > 0 ? mergedPhones : [normalizedPhone];
    const phonesToDelete = new Set<string>();
    basePhones.forEach(phone => {
      generatePhoneVariations(phone).forEach(v => phonesToDelete.add(v));
      phonesToDelete.add(phone);
    });
    const phonesArray = Array.from(phonesToDelete);

    addActivityLog({ type: "action", category: "Clientes", message: `Iniciando exclusão do cliente: ${normalizedPhone}`, details: `Variações: ${phonesArray.length}` });

    // Delete transactions
    const { error: txError } = await supabase
      .from("transactions")
      .delete()
      .in("normalized_phone", phonesArray);
    
    if (txError) {
      toast.error("Erro ao excluir transações");
      addActivityLog({ type: "error", category: "Clientes", message: "Erro ao excluir transações do cliente", details: txError.message });
      throw txError;
    }

    // Delete abandoned events
    const { error: abError } = await supabase
      .from("abandoned_events")
      .delete()
      .in("normalized_phone", phonesArray);
    
    if (abError) {
      toast.error("Erro ao excluir eventos abandonados");
      addActivityLog({ type: "error", category: "Clientes", message: "Erro ao excluir eventos abandonados do cliente", details: abError.message });
      throw abError;
    }

    // Delete PIX link generations
    const { error: pixError } = await supabase
      .from("delivery_link_generations")
      .delete()
      .in("normalized_phone", phonesArray);
    
    if (pixError) {
      console.error("Erro ao excluir PIX links:", pixError);
      addActivityLog({ type: "warning", category: "Clientes", message: "Erro ao excluir PIX links do cliente", details: pixError.message });
    }

    // Delete customer records (may have multiple merged)
    for (const phone of basePhones) {
      await supabase
        .from("customers")
        .delete()
        .eq("normalized_phone", phone);
    }
    
    // Also delete by ID to be sure
    const { error: custError } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);
    
    if (custError) {
      toast.error("Erro ao excluir cliente");
      addActivityLog({ type: "error", category: "Clientes", message: "Erro ao excluir cliente", details: custError.message });
      throw custError;
    }
    
    toast.success("Cliente e dados excluídos");
    addActivityLog({ type: "success", category: "Clientes", message: `Cliente excluído completamente: ${normalizedPhone}` });
    
    // Invalidate all related queries for real-time update
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-events"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["abandonedEvents"] }),
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-contacts"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-payment-methods"] }),
    ]);
  };

  const unlinkPixLink = async (pixLinkId: string, customerNormalizedPhone?: string) => {
    const { error } = await supabase
      .from("delivery_link_generations")
      .delete()
      .eq("id", pixLinkId);
    
    if (error) {
      toast.error("Erro ao desvincular PIX");
      addActivityLog({ type: "error", category: "PIX", message: "Erro ao desvincular PIX", details: error.message });
      throw error;
    }
    
    // Recalculate customer stats after unlinking PIX
    if (customerNormalizedPhone) {
      await supabase.rpc("refresh_customer_stats", { customer_normalized_phone: customerNormalizedPhone });
    }
    
    toast.success("PIX desvinculado do cliente");
    addActivityLog({ type: "action", category: "PIX", message: `PIX desvinculado do cliente: ${customerNormalizedPhone || pixLinkId}` });
    
    // Invalidate all related queries for real-time update
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-events"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-payment-methods"] }),
    ]);
  };

  return { customers, isLoading, refetch, updateCustomer, deleteTransaction, deleteAbandonedEvent, deleteCustomerWithData, unlinkPixLink };
}

export function useCustomerPaymentMethods() {
  const { data = {}, isLoading } = useQuery({
    queryKey: ["customer-payment-methods"],
    queryFn: async () => {
      // Buscar métodos de pagamento das transações
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("normalized_phone, type")
        .not("normalized_phone", "is", null);

      if (txError) throw txError;

      // Buscar métodos de pagamento dos links de entrega (PIX)
      const { data: deliveryLinks, error: dlError } = await supabase
        .from("delivery_link_generations")
        .select("normalized_phone, payment_method")
        .not("normalized_phone", "is", null);

      if (dlError) throw dlError;

      const methodsByPhone: Record<string, Set<string>> = {};
      
      // Adicionar métodos das transações
      (transactions || []).forEach((t) => {
        if (!t.normalized_phone) return;
        const normalizedKey = normalizePhoneForMatching(t.normalized_phone) || t.normalized_phone;
        if (!methodsByPhone[normalizedKey]) {
          methodsByPhone[normalizedKey] = new Set();
        }
        methodsByPhone[normalizedKey].add(t.type);
      });

      // Adicionar métodos dos links de entrega
      (deliveryLinks || []).forEach((dl) => {
        if (!dl.normalized_phone) return;
        const normalizedKey = normalizePhoneForMatching(dl.normalized_phone) || dl.normalized_phone;
        if (!methodsByPhone[normalizedKey]) {
          methodsByPhone[normalizedKey] = new Set();
        }
        // Converter payment_method para o tipo correspondente
        if (dl.payment_method === 'pix') {
          methodsByPhone[normalizedKey].add('pix');
        } else if (dl.payment_method === 'cartao_boleto') {
          methodsByPhone[normalizedKey].add('cartao');
          methodsByPhone[normalizedKey].add('boleto');
        }
      });

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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customer-events", normalizedPhone, mergedPhones],
    enabled: !!normalizedPhone,
    queryFn: async () => {
      if (!normalizedPhone) return { events: [], stats: null };

      // Generate all phone variations for comprehensive matching
      const basePhones = mergedPhones && mergedPhones.length > 0 
        ? mergedPhones 
        : [normalizedPhone];
      
      // Generate all variations for each base phone
      const phonesToSearchSet = new Set<string>();
      basePhones.forEach(phone => {
        generatePhoneVariations(phone).forEach(v => phonesToSearchSet.add(v));
        phonesToSearchSet.add(phone);
      });
      
      const phonesArray = Array.from(phonesToSearchSet);
      
      // Fetch transactions
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("id, type, status, amount, description, created_at, paid_at, external_id, normalized_phone")
        .in("normalized_phone", phonesArray)
        .order("created_at", { ascending: false });

      if (txError) throw txError;

      // Fetch abandoned events
      const { data: abandonedEvents, error: abError } = await supabase
        .from("abandoned_events")
        .select("id, event_type, amount, product_name, error_message, created_at, normalized_phone")
        .in("normalized_phone", phonesArray)
        .order("created_at", { ascending: false });

      if (abError) throw abError;

      // Fetch PIX link generations
      const { data: pixLinks, error: pixError } = await supabase
        .from("delivery_link_generations")
        .select("id, created_at, product_id, payment_method, normalized_phone")
        .in("normalized_phone", phonesArray)
        .eq("payment_method", "pix")
        .order("created_at", { ascending: false });

      if (pixError) throw pixError;

      // Fetch delivery accesses (to track when user accessed PIX link)
      const { data: deliveryAccesses, error: daError } = await supabase
        .from("delivery_accesses")
        .select("id, phone, product_id, accessed_at, pixel_fired")
        .order("accessed_at", { ascending: false });

      if (daError) throw daError;

      // Filter delivery accesses by normalized phone
      const filteredAccesses = (deliveryAccesses || []).filter(da => {
        const normalizedAccessPhone = da.phone.replace(/\D/g, '');
        return phonesArray.some(p => {
          const normalizedSearch = p.replace(/\D/g, '');
          return normalizedAccessPhone.includes(normalizedSearch) || normalizedSearch.includes(normalizedAccessPhone);
        });
      });

      // Fetch product info
      const productIds = [...new Set([
        ...(pixLinks || []).map(p => p.product_id),
        ...filteredAccesses.map(a => a.product_id)
      ])];
      
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

      // Calculate stats
      const stats: CustomerStats = {
        boleto: { count: 0, paid: 0, pending: 0, totalPaid: 0, totalPending: 0 },
        pix: { count: 0, paid: 0, pending: 0, totalPaid: 0, totalPending: 0 },
        cartao: { count: 0, paid: 0, pending: 0, totalPaid: 0, totalPending: 0 },
        abandoned: { count: abandonedEvents?.length || 0, totalAmount: 0 },
        deliveryAccesses: filteredAccesses.length,
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

      (pixLinks || []).forEach((p) => {
        const product = productsMap[p.product_id];
        stats.pix.count++;
        stats.pix.paid++;
        stats.pix.totalPaid += product?.value || 0;
      });

      (abandonedEvents || []).forEach((a) => {
        stats.abandoned.totalAmount += Number(a.amount) || 0;
      });

      // Combine all events
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
        ...filteredAccesses.map((a) => ({
          id: a.id,
          type: "delivery_access" as const,
          product_name: productsMap[a.product_id]?.name || "Produto",
          amount: null,
          created_at: a.accessed_at,
          description: `Acessou link de entrega: ${productsMap[a.product_id]?.name || "Produto"}`,
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

      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { events: allEvents, stats };
    },
  });

  return { 
    events: data?.events || [], 
    stats: data?.stats || null, 
    isLoading,
    refetch 
  };
}

export async function refreshCustomerStats(normalizedPhone?: string) {
  const { error } = await supabase.rpc("refresh_customer_stats", {
    customer_normalized_phone: normalizedPhone || null,
  });
  if (error) throw error;
}