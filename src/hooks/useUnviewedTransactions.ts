import { useMemo, useEffect, useState } from "react";
import { Transaction } from "./useTransactions";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

const VIEWED_STORAGE_KEY = "viewed_transactions";

type TabKey = "aprovados" | "boletos-gerados" | "pix-cartao-pendentes";

export function useUnviewedTransactions(transactions: Transaction[]) {
  const [viewedIds, setViewedIds] = useState<Record<TabKey, string[]>>(() => {
    try {
      const stored = localStorage.getItem(VIEWED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : { aprovados: [], "boletos-gerados": [], "pix-cartao-pendentes": [] };
    } catch {
      return { aprovados: [], "boletos-gerados": [], "pix-cartao-pendentes": [] };
    }
  });

  // Listen for localStorage changes from other tabs/components
  useEffect(() => {
    let lastRaw = localStorage.getItem(VIEWED_STORAGE_KEY);
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem(VIEWED_STORAGE_KEY);
        if (raw === lastRaw) return; // skip redundant setState
        lastRaw = raw;
        if (raw) {
          setViewedIds(JSON.parse(raw));
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(handleStorageChange, 1000);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Filter transactions by "today" (matching the default filter in TransactionsTable)
  const todayTransactions = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    
    return transactions.filter((t) => {
      // For paid transactions, use paid_at if available, otherwise use created_at
      const dateStr = t.status === "pago" && t.paid_at ? t.paid_at : t.created_at;
      const date = new Date(dateStr);
      return isWithinInterval(date, { start: todayStart, end: todayEnd });
    });
  }, [transactions]);

  // Categorize transactions by tab
  const tabTransactions = useMemo(() => ({
    aprovados: todayTransactions.filter(t => t.status === "pago"),
    "boletos-gerados": todayTransactions.filter(t => t.type === "boleto" && t.status === "gerado"),
    "pix-cartao-pendentes": todayTransactions.filter(t => (t.type === "pix" || t.type === "cartao") && t.status === "pendente"),
  }), [todayTransactions]);

  // Calculate total unviewed count across all tabs
  const totalUnviewed = useMemo(() => {
    let total = 0;
    (Object.keys(tabTransactions) as TabKey[]).forEach((tab) => {
      const tabTxIds = tabTransactions[tab].map(t => t.id);
      const viewedInTab = viewedIds[tab] || [];
      total += tabTxIds.filter(id => !viewedInTab.includes(id)).length;
    });
    return total;
  }, [tabTransactions, viewedIds]);

  return totalUnviewed;
}
