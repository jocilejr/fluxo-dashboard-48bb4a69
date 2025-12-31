import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useTabNotification } from "./useTabNotification";
import { addActivityLog } from "@/components/settings/ActivityLogs";

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
  const { notifyNewTransaction } = useTabNotification();
  const [notifications, setNotifications] = useState<TransactionNotification[]>([]);
  
  // Store callback in ref to avoid re-subscriptions
  const notifyNewTransactionRef = useRef(notifyNewTransaction);
  
  useEffect(() => {
    notifyNewTransactionRef.current = notifyNewTransaction;
  }, [notifyNewTransaction]);

  const { data: transactions, refetch, isLoading } = useQuery({
    queryKey: ["transactions", options?.startDate?.toISOString(), options?.endDate?.toISOString()],
    queryFn: async () => {
      // Fetch all transactions - filtering will be done in the frontend
      // to properly handle paid_at vs created_at based on status
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Track seen transaction IDs to avoid duplicate notifications
  const seenTransactionIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Pre-populate seen IDs with existing transactions (separate effect)
  useEffect(() => {
    if (transactions && transactions.length > 0 && !hasInitializedRef.current) {
      transactions.forEach(t => seenTransactionIdsRef.current.add(`${t.id}-${t.status}`));
      hasInitializedRef.current = true;
      console.log("[Realtime] Pre-populated seen IDs:", seenTransactionIdsRef.current.size);
    }
  }, [transactions]);

  // Subscribe to realtime updates with notifications (separate effect, no transactions dependency)
  useEffect(() => {
    // Cleanup previous channel if exists
    if (channelRef.current) {
      console.log("[Realtime] Cleaning up previous channel...");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log("[Realtime] Setting up subscription...");
    
    const channelId = `transactions-realtime-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          console.log("[Realtime] Update received:", payload.eventType, payload);
          refetch();

          // Handle notifications for INSERT and UPDATE events
          if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;
          
          const newData = payload.new as Transaction;
          const oldData = payload.old as Transaction | null;
          
          if (!newData || !newData.type || !newData.status) {
            console.log("[Realtime] Invalid payload data, skipping notification");
            return;
          }

          // Check if we've already seen this transaction+status combination
          const transactionKey = `${newData.id}-${newData.status}`;
          if (seenTransactionIdsRef.current.has(transactionKey)) {
            console.log("[Realtime] Already seen this transaction, skipping:", transactionKey);
            return;
          }

          // Determine notification type
          let shouldNotify = false;
          let notificationStatus: "gerado" | "pago" | "pendente" = "gerado";

          if (payload.eventType === "INSERT") {
            shouldNotify = true;
            notificationStatus = newData.status === "pago" ? "pago" : 
                                 newData.status === "pendente" ? "pendente" : "gerado";
          } else if (payload.eventType === "UPDATE") {
            // Only notify if status changed to "pago"
            if (oldData && oldData.status !== "pago" && newData.status === "pago") {
              shouldNotify = true;
              notificationStatus = "pago";
            }
          }

          if (shouldNotify) {
            // Mark as seen
            seenTransactionIdsRef.current.add(transactionKey);
            console.log("[Realtime] Creating notification for:", transactionKey);

            const notification: TransactionNotification = {
              id: newData.id,
              type: newData.type,
              status: notificationStatus,
              customerName: newData.customer_name || "Cliente",
              amount: newData.amount,
              timestamp: new Date(),
            };

            setNotifications(prev => {
              const updated = [notification, ...prev.slice(0, 9)];
              console.log("[Realtime] Notifications updated, count:", updated.length);
              return updated;
            });

            // Notify tab title when in background
            notifyNewTransactionRef.current();
            
            // Log the transaction
            const typeLabel = newData.type === 'boleto' ? 'Boleto' : newData.type === 'pix' ? 'PIX' : 'Cartão';
            const statusLabel = notificationStatus === 'pago' ? 'Pago' : notificationStatus === 'pendente' ? 'Pendente' : 'Gerado';
            const amount = newData.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            addActivityLog({
              type: notificationStatus === 'pago' ? 'success' : 'info',
              category: 'Transação',
              message: `${typeLabel} ${statusLabel}: ${newData.customer_name || 'Cliente'}`,
              details: `Valor: ${amount}, Telefone: ${newData.customer_phone || 'N/A'}, ID: ${newData.id}`
            });
            
            // Browser notification via Service Worker
            if (Notification.permission === 'granted' && navigator.serviceWorker) {
              const title = getNotificationTitle(newData.type, notificationStatus);
              console.log('[Notification] Raw amount:', newData.amount, 'Formatted:', amount);
              
              navigator.serviceWorker.ready
                .then((registration) => {
                  return registration.showNotification(title, {
                    body: `${newData.customer_name || 'Cliente'} - ${amount}`,
                    icon: '/logo-ov.png',
                    badge: '/favicon.png',
                    tag: `transaction-${newData.id}-${notificationStatus}`,
                  });
                })
                .catch(() => {});
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Subscription status:", status);
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
        }
      });

    return () => {
      console.log("[Realtime] Cleaning up subscription...");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [refetch]);

  // Calculate stats
  const stats: TransactionStats = {
    boletosGerados: transactions?.filter((t) => t.type === "boleto").length || 0,
    boletosPagos: transactions?.filter((t) => t.type === "boleto" && t.status === "pago").length || 0,
    pixGerado: transactions?.filter((t) => t.type === "pix").length || 0,
    pixPago: transactions?.filter((t) => t.type === "pix" && t.status === "pago").length || 0,
    pedidosCartao: transactions?.filter((t) => t.type === "cartao").length || 0,
    volumeCartao: transactions?.filter((t) => t.type === "cartao" && t.status === "pago")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
  };

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const hasNewTransaction = notifications.length > 0;

  return {
    transactions: transactions || [],
    stats,
    isLoading,
    refetch,
    hasNewTransaction,
    notifications,
    dismissNotification,
    dismissAllNotifications,
  };
}

function getNotificationTitle(type: Transaction["type"], status: "gerado" | "pago" | "pendente"): string {
  const titles: Record<string, Record<string, string>> = {
    boleto: {
      gerado: "📄 Boleto Gerado",
      pago: "✅ Boleto Pago",
      pendente: "⏳ Boleto Pendente",
    },
    pix: {
      gerado: "📱 PIX Gerado",
      pago: "✅ PIX Pago",
      pendente: "⏳ PIX Pendente",
    },
    cartao: {
      gerado: "💳 Cartão - Pedido",
      pago: "✅ Cartão Pago",
      pendente: "⏳ Cartão Pendente",
    },
  };
  return titles[type]?.[status] || "🔔 Nova Transação";
}
