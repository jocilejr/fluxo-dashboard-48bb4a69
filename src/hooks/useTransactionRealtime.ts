import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTabNotification } from "./useTabNotification";
import { addActivityLog } from "@/components/settings/ActivityLogs";
import type { Transaction, TransactionNotification } from "./useTransactions";
import { clearRecoveryLogFromCache } from "@/lib/localCache";

function getNotificationTitle(type: Transaction["type"], status: "gerado" | "pago" | "pendente"): string {
  const titles: Record<string, Record<string, string>> = {
    boleto: { gerado: "📄 Boleto Gerado", pago: "✅ Boleto Pago", pendente: "⏳ Boleto Pendente" },
    pix: { gerado: "📱 PIX Gerado", pago: "✅ PIX Pago", pendente: "⏳ PIX Pendente" },
    cartao: { gerado: "💳 Cartão - Pedido", pago: "✅ Cartão Pago", pendente: "⏳ Cartão Pendente" },
  };
  return titles[type]?.[status] || "🔔 Nova Transação";
}

export function useTransactionRealtime() {
  const queryClient = useQueryClient();
  const { notifyNewTransaction } = useTabNotification();
  const [notifications, setNotifications] = useState<TransactionNotification[]>([]);
  
  const notifyRef = useRef(notifyNewTransaction);
  useEffect(() => { notifyRef.current = notifyNewTransaction; }, [notifyNewTransaction]);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Pre-populate seen IDs from cached data once
  useEffect(() => {
    if (initializedRef.current) return;
    const cached = queryClient.getQueryData<Transaction[]>(["transactions"]);
    if (cached && cached.length > 0) {
      cached.forEach(t => seenIdsRef.current.add(`${t.id}-${t.status}`));
      initializedRef.current = true;
    }
  });

  // Single realtime channel
  useEffect(() => {
    const channel = supabase
      .channel("transactions-global-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          console.log("[Realtime] Event:", payload.eventType);

          const newData = payload.new as Transaction;
          const oldData = payload.old as Transaction | null;

          // Optimistic cache update
          if (payload.eventType === "INSERT" && newData) {
            queryClient.setQueryData<Transaction[]>(["transactions"], (old) => {
              if (!old) return [newData];
              // Avoid duplicates
              if (old.some(t => t.id === newData.id)) return old;
              return [newData, ...old];
            });
          } else if (payload.eventType === "UPDATE" && newData) {
            queryClient.setQueryData<Transaction[]>(["transactions"], (old) => {
              if (!old) return [newData];
              return old.map(t => t.id === newData.id ? { ...t, ...newData } : t);
            });
          } else if (payload.eventType === "DELETE" && oldData) {
            queryClient.setQueryData<Transaction[]>(["transactions"], (old) => {
              if (!old) return [];
              return old.filter(t => t.id !== oldData.id);
            });
          }

          // Mark stale for background refetch
          queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "none" });

          // Notifications
          if (!newData || !newData.type || !newData.status) return;
          if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;

          const key = `${newData.id}-${newData.status}`;
          if (seenIdsRef.current.has(key)) return;

          let shouldNotify = false;
          let notifStatus: "gerado" | "pago" | "pendente" = "gerado";

          if (payload.eventType === "INSERT") {
            shouldNotify = true;
            notifStatus = newData.status === "pago" ? "pago" : newData.status === "pendente" ? "pendente" : "gerado";
          } else if (payload.eventType === "UPDATE" && oldData && oldData.status !== "pago" && newData.status === "pago") {
            shouldNotify = true;
            notifStatus = "pago";
          }

          if (!shouldNotify) return;

          seenIdsRef.current.add(key);

          const notification: TransactionNotification = {
            id: newData.id,
            type: newData.type,
            status: notifStatus,
            customerName: newData.customer_name || "Cliente",
            amount: newData.amount,
            timestamp: new Date(),
          };

          setNotifications(prev => [notification, ...prev.slice(0, 9)]);
          notifyRef.current();

          // Activity log
          const typeLabel = newData.type === "boleto" ? "Boleto" : newData.type === "pix" ? "PIX" : "Cartão";
          const statusLabel = notifStatus === "pago" ? "Pago" : notifStatus === "pendente" ? "Pendente" : "Gerado";
          const amount = newData.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

          addActivityLog({
            type: notifStatus === "pago" ? "success" : "info",
            category: "Transação",
            message: `${typeLabel} ${statusLabel}: ${newData.customer_name || "Cliente"}`,
            details: `Valor: ${amount}, Telefone: ${newData.customer_phone || "N/A"}, ID: ${newData.id}`,
          });

          // Browser notification
          if (Notification.permission === "granted" && navigator.serviceWorker) {
            const title = getNotificationTitle(newData.type, notifStatus);
            navigator.serviceWorker.ready
              .then((reg) => reg.showNotification(title, {
                body: `${newData.customer_name || "Cliente"} - ${amount}`,
                icon: "/logo-ov.png",
                badge: "/favicon.png",
                tag: `transaction-${newData.id}-${notifStatus}`,
              }))
              .catch(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evolution_message_log" },
        (payload) => {
          console.log("[Realtime] Recovery log event:", payload.eventType);
          const newLog = payload.new as any;
          
          // Clear local cache for the affected transaction so it re-fetches
          if (newLog?.transaction_id) {
            clearRecoveryLogFromCache(newLog.transaction_id);
          }
          
          // Invalidate React Query cache to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['transaction-recovery-logs-db'] });
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Global channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    hasNewTransaction: notifications.length > 0,
    dismissNotification,
    dismissAllNotifications,
  };
}
