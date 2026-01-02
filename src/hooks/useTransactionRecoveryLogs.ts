import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TransactionRecoveryLog {
  transaction_id: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string | null;
  error_message: string | null;
}

// Use Record instead of Map to ensure React detects changes
export type RecoveryLogsRecord = Record<string, TransactionRecoveryLog>;

export function useTransactionRecoveryLogs(transactionIds: string[]) {
  const [logs, setLogs] = useState<RecoveryLogsRecord>({});
  const [isLoading, setIsLoading] = useState(false);

  // Create stable key from sorted valid IDs
  const idsKey = useMemo(() => {
    const validIds = transactionIds.filter(id => id && id.length > 0);
    return validIds.sort().join(',');
  }, [transactionIds]);

  useEffect(() => {
    if (!idsKey) {
      setLogs({});
      return;
    }

    const validIds = idsKey.split(',');
    
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('evolution_message_log')
          .select('transaction_id, status, sent_at, error_message')
          .not('transaction_id', 'is', null)
          .in('transaction_id', validIds)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[RecoveryLogs] Error:', error);
          throw error;
        }

        console.log('[RecoveryLogs] Fetched:', data?.length, 'logs for', validIds.length, 'transactions');

        // Use object instead of Map - React detects object changes better
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

        console.log('[RecoveryLogs] Mapped:', Object.keys(logsRecord).length, 'unique transactions');
        setLogs(logsRecord);
      } catch (error) {
        console.error('[RecoveryLogs] Error fetching:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [idsKey]);

  const getRecoveryStatus = (transactionId: string): TransactionRecoveryLog | null => {
    return logs[transactionId] || null;
  };

  return { logs, isLoading, getRecoveryStatus };
}
