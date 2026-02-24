import { useMemo, useState, useEffect } from "react";
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
  // Initialize from localStorage cache immediately
  const [localCacheLogs, setLocalCacheLogs] = useState<RecoveryLogsRecord>(() => {
    const cached = getRecoveryLogsFromCache();
    const result: RecoveryLogsRecord = {};
    
    for (const [transactionId, log] of Object.entries(cached)) {
      result[transactionId] = {
        transaction_id: transactionId,
        status: log.status,
        sent_at: log.sentAt,
        error_message: log.errorMessage,
      };
    }
    
    return result;
  });

  // Filter valid IDs
  const validIds = useMemo(() => {
    return transactionIds.filter(id => id && id.length > 0);
  }, [transactionIds]);

  // Find IDs not in local cache
  const idsNotInLocalCache = useMemo(() => {
    return validIds.filter(id => !localCacheLogs[id]);
  }, [validIds, localCacheLogs]);

  // Only fetch from database for IDs not in local cache
  const { data: dbLogs = {}, isLoading } = useQuery({
    queryKey: ['transaction-recovery-logs-db', idsNotInLocalCache],
    queryFn: async (): Promise<RecoveryLogsRecord> => {
      if (idsNotInLocalCache.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from('evolution_message_log')
        .select('transaction_id, status, sent_at, error_message')
        .not('transaction_id', 'is', null)
        .in('transaction_id', idsNotInLocalCache)
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
      
      return logsRecord;
    },
    enabled: idsNotInLocalCache.length > 0,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  // Update local cache when we get new data from database
  useEffect(() => {
    if (Object.keys(dbLogs).length === 0) return;

    // Update state
    setLocalCacheLogs(prev => ({ ...prev, ...dbLogs }));

    // Save to localStorage
    const cacheData: Record<string, CachedRecoveryLog> = {};
    for (const [transactionId, log] of Object.entries(dbLogs)) {
      cacheData[transactionId] = {
        status: log.status,
        sentAt: log.sent_at,
        errorMessage: log.error_message,
      };
    }
    saveRecoveryLogsToCache(cacheData);
  }, [dbLogs]);

  // Merge local cache with db logs
  const logs = useMemo(() => {
    return { ...localCacheLogs, ...dbLogs };
  }, [localCacheLogs, dbLogs]);

  const getRecoveryStatus = (transactionId: string): TransactionRecoveryLog | null => {
    return logs[transactionId] || null;
  };

  return { logs, isLoading, getRecoveryStatus };
}
