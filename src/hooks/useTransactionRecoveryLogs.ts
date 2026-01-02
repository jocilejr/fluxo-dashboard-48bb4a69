import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TransactionRecoveryLog {
  transaction_id: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string | null;
  error_message: string | null;
}

export function useTransactionRecoveryLogs(transactionIds: string[]) {
  const [logs, setLogs] = useState<Map<string, TransactionRecoveryLog>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Create a stable key for the dependency
  const idsKey = useMemo(() => transactionIds.sort().join(','), [transactionIds]);

  useEffect(() => {
    if (transactionIds.length === 0) {
      setLogs(new Map());
      return;
    }

    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        // Fetch all logs that have a transaction_id matching any of the provided IDs
        const { data, error } = await supabase
          .from('evolution_message_log')
          .select('transaction_id, status, sent_at, error_message')
          .not('transaction_id', 'is', null)
          .in('transaction_id', transactionIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('[RecoveryLogs] Fetched logs:', data?.length, 'for', transactionIds.length, 'transactions');

        // Group by transaction_id, keeping only the most recent log
        const logsMap = new Map<string, TransactionRecoveryLog>();
        data?.forEach((log) => {
          if (log.transaction_id && !logsMap.has(log.transaction_id)) {
            logsMap.set(log.transaction_id, {
              transaction_id: log.transaction_id,
              status: log.status as 'sent' | 'failed' | 'pending',
              sent_at: log.sent_at,
              error_message: log.error_message,
            });
          }
        });

        setLogs(logsMap);
      } catch (error) {
        console.error('Error fetching recovery logs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [idsKey]);

  const getRecoveryStatus = (transactionId: string) => {
    return logs.get(transactionId) || null;
  };

  return { logs, isLoading, getRecoveryStatus };
}
