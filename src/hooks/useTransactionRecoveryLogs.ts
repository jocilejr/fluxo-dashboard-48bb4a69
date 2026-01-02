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
  // Filter valid IDs immediately
  const validIds = useMemo(() => {
    const filtered = transactionIds.filter(id => id && id.length > 0);
    return filtered;
  }, [transactionIds]);

  const { data: logs = {}, isLoading } = useQuery({
    queryKey: ['transaction-recovery-logs', validIds],
    queryFn: async (): Promise<RecoveryLogsRecord> => {
      console.log('[RecoveryLogs] queryFn starting with', validIds.length, 'IDs');
      
      if (validIds.length === 0) {
        console.log('[RecoveryLogs] No valid IDs, returning empty');
        return {};
      }

      console.log('[RecoveryLogs] Fetching logs for IDs:', validIds.slice(0, 5), '...');

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

      console.log('[RecoveryLogs] Mapped logs:', Object.keys(logsRecord).length, 'transactions');
      console.log('[RecoveryLogs] Log entries:', Object.entries(logsRecord).slice(0, 3));
      
      return logsRecord;
    },
    enabled: validIds.length > 0,
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true,
  });

  // Debug log on every render
  console.log('[RecoveryLogs] Hook render - validIds:', validIds.length, 'logs:', Object.keys(logs).length, 'loading:', isLoading);

  const getRecoveryStatus = (transactionId: string): TransactionRecoveryLog | null => {
    return logs[transactionId] || null;
  };

  return { logs, isLoading, getRecoveryStatus };
}
