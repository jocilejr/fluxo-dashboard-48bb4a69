import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TransactionRecoveryLog {
  transaction_id: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string | null;
  error_message: string | null;
}

export type RecoveryLogsRecord = Record<string, TransactionRecoveryLog>;

export function useTransactionRecoveryLogs(transactionIds: string[]) {
  // Create stable key from sorted valid IDs
  const idsKey = useMemo(() => {
    const validIds = transactionIds.filter(id => id && id.length > 0);
    console.log('[RecoveryLogs] Hook called with', validIds.length, 'valid IDs');
    return validIds.sort().join(',');
  }, [transactionIds]);

  const { data: logs = {}, isLoading } = useQuery({
    queryKey: ['transaction-recovery-logs', idsKey],
    queryFn: async (): Promise<RecoveryLogsRecord> => {
      if (!idsKey) {
        console.log('[RecoveryLogs] No IDs to fetch');
        return {};
      }

      const validIds = idsKey.split(',');
      console.log('[RecoveryLogs] Fetching logs for', validIds.length, 'transactions');

      const { data, error } = await supabase
        .from('evolution_message_log')
        .select('transaction_id, status, sent_at, error_message')
        .not('transaction_id', 'is', null)
        .in('transaction_id', validIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[RecoveryLogs] Query error:', error);
        throw error;
      }

      console.log('[RecoveryLogs] Raw data received:', data?.length, 'logs');

      // Group by transaction_id, keeping only the most recent log
      const logsRecord: RecoveryLogsRecord = {};
      data?.forEach((log) => {
        if (log.transaction_id && !logsRecord[log.transaction_id]) {
          logsRecord[log.transaction_id] = {
            transaction_id: log.transaction_id,
            status: log.status as 'sent' | 'failed' | 'pending',
            sent_at: log.sent_at,
            error_message: log.error_message,
          };
        }
      });

      console.log('[RecoveryLogs] Mapped logs:', Object.keys(logsRecord).length, 'unique transactions');
      console.log('[RecoveryLogs] Sample logs:', Object.entries(logsRecord).slice(0, 3));
      
      return logsRecord;
    },
    enabled: idsKey.length > 0,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  const getRecoveryStatus = (transactionId: string): TransactionRecoveryLog | null => {
    const result = logs[transactionId] || null;
    return result;
  };

  return { logs, isLoading, getRecoveryStatus };
}
