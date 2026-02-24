import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getRecoveryLogsFromCache,
  saveRecoveryLogsToCache,
  CachedRecoveryLog
} from "@/lib/localCache";

export interface TransactionRecoveryLog {
  transaction_id: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string | null;
  error_message: string | null;
}

export type RecoveryLogsRecord = Record<string, TransactionRecoveryLog>;

export function useTransactionRecoveryLogs(transactionIds: string[]) {
  // Filter valid IDs
  const validIds = useMemo(() => {
    return transactionIds.filter(id => id && id.length > 0);
  }, [transactionIds]);

  // Always fetch from database for all visible IDs, using localStorage only as initialData
  const { data: logs = {}, isLoading } = useQuery({
    queryKey: ['transaction-recovery-logs', validIds],
    queryFn: async (): Promise<RecoveryLogsRecord> => {
      if (validIds.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from('evolution_message_log')
        .select('transaction_id, status, sent_at, error_message')
        .not('transaction_id', 'is', null)
        .in('transaction_id', validIds)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

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

      // Save to localStorage for future initial loads
      const cacheData: Record<string, CachedRecoveryLog> = {};
      for (const [transactionId, log] of Object.entries(logsRecord)) {
        cacheData[transactionId] = {
          status: log.status,
          sentAt: log.sent_at,
          errorMessage: log.error_message,
        };
      }
      saveRecoveryLogsToCache(cacheData);
      
      return logsRecord;
    },
    // Use localStorage cache as placeholder/initial data for instant UI
    placeholderData: () => {
      const cached = getRecoveryLogsFromCache();
      const result: RecoveryLogsRecord = {};
      for (const id of validIds) {
        if (cached[id]) {
          result[id] = {
            transaction_id: id,
            status: cached[id].status,
            sent_at: cached[id].sentAt,
            error_message: cached[id].errorMessage,
          };
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    },
    enabled: validIds.length > 0,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  const getRecoveryStatus = (transactionId: string): TransactionRecoveryLog | null => {
    return logs[transactionId] || null;
  };

  return { logs, isLoading, getRecoveryStatus };
}
