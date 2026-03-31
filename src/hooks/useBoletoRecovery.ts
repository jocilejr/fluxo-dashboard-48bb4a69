import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Transaction } from "./useTransactions";
import { useMemo, useEffect, useState } from "react";
import { addDays, differenceInDays, isBefore, startOfDay, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getGreeting } from "@/lib/greeting";

const BRAZIL_TIMEZONE = "America/Sao_Paulo";

// ── Shared day calculation (same logic as backend) ──
function getTodayBrazil(): Date {
  return startOfDay(toZonedTime(new Date(), BRAZIL_TIMEZONE));
}

function calcDaysSinceGeneration(createdAt: string): number {
  const created = startOfDay(toZonedTime(new Date(createdAt), BRAZIL_TIMEZONE));
  return differenceInDays(getTodayBrazil(), created);
}

// ── Types ──
export interface RecoveryRule {
  id: string;
  name: string;
  rule_type: "days_after_generation" | "days_before_due" | "days_after_due";
  days: number;
  message: string;
  is_active: boolean;
  priority: number;
  media_blocks?: any;
}

export interface BoletoWithRecovery extends Transaction {
  dueDate: Date;
  daysUntilDue: number;
  daysSinceGeneration: number;
  isOverdue: boolean;
  applicableRule: RecoveryRule | null;
  formattedMessage: string | null;
  contactedToday: boolean;
}

export function useBoletoRecovery() {
  const queryClient = useQueryClient();

  // ── Realtime subscriptions ──
  useEffect(() => {
    const channel = supabase
      .channel("boleto-recovery-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_log" }, () => {
        queryClient.invalidateQueries({ queryKey: ["boleto-today-logs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["unpaid-boletos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Query 1: unpaid boletos ──
  const { data: unpaidBoletos, isLoading } = useQuery({
    queryKey: ["unpaid-boletos"],
    staleTime: 60000,
    queryFn: async () => {
      const all: Transaction[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("type", "boleto")
          .not("status", "in", '("pago","cancelado","expirado")')
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          all.push(...(data as Transaction[]));
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      return all;
    },
  });

  // ── Query 2: active rules ──
  const { data: rules } = useQuery({
    queryKey: ["boleto-recovery-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_recovery_rules")
        .select("*")
        .eq("is_active", true)
        .neq("rule_type", "immediate")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as RecoveryRule[];
    },
  });

  // ── Query 3: today's sent logs with rule_id (source of truth) ──
  const todayStr = format(getTodayBrazil(), "yyyy-MM-dd");
  const { data: todayLogs } = useQuery({
    queryKey: ["boleto-today-logs", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_log")
        .select("transaction_id, rule_id")
        .eq("message_type", "boleto")
        .eq("status", "sent")
        .gte("created_at", `${todayStr}T00:00:00-03:00`)
        .lt("created_at", `${todayStr}T23:59:59-03:00`);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Query 4: boleto settings ──
  const { data: settings } = useQuery({
    queryKey: ["boleto-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── Query 5: default template ──
  const { data: defaultTemplate } = useQuery({
    queryKey: ["boleto-default-template"],
    queryFn: async () => {
      // Try default first
      const { data: def } = await supabase
        .from("boleto_recovery_templates")
        .select("*")
        .eq("is_default", true)
        .maybeSingle();
      if (def) return def;
      // Fallback to first
      const { data: first } = await supabase
        .from("boleto_recovery_templates")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return first;
    },
  });

  // ── Build lookup set of contacted transaction:rule keys ──
  const contactedKeys = useMemo(() => {
    const set = new Set<string>();
    todayLogs?.forEach((l) => {
      if (l.transaction_id && l.rule_id) set.add(`${l.transaction_id}:${l.rule_id}`);
    });
    return set;
  }, [todayLogs]);

  // ── Single processing pass ──
  const processedBoletos = useMemo(() => {
    const boletos = unpaidBoletos ?? [];
    const expirationDays = settings?.default_expiration_days || 3;
    const today = getTodayBrazil();

    return boletos.map((boleto): BoletoWithRecovery => {
      const daysSinceGeneration = calcDaysSinceGeneration(boleto.created_at);
      const createdDay = startOfDay(toZonedTime(new Date(boleto.created_at), BRAZIL_TIMEZONE));
      const dueDate = addDays(createdDay, expirationDays);
      const daysUntilDue = differenceInDays(dueDate, today);
      const isOverdue = isBefore(dueDate, today);

      // Find matching rule
      let applicableRule: RecoveryRule | null = null;
      if (rules) {
        for (const rule of rules) {
          let matches = false;
          if (rule.rule_type === "days_after_generation" && daysSinceGeneration === rule.days) matches = true;
          else if (rule.rule_type === "days_before_due" && daysUntilDue === rule.days) matches = true;
          else if (rule.rule_type === "days_after_due" && isOverdue && Math.abs(daysUntilDue) === rule.days) matches = true;
          if (matches) { applicableRule = rule; break; }
        }
      }

      const contactedToday = applicableRule ? contactedKeys.has(`${boleto.id}:${applicableRule.id}`) : false;

      let formattedMessage: string | null = null;
      if (applicableRule) {
        // Use template blocks if available, otherwise fallback to rule message
        const templateBlocks = (defaultTemplate?.blocks as Array<{ type: string; content?: string }>) || [];
        const textBlocks = templateBlocks.filter(b => b.type === 'text' && b.content);
        if (textBlocks.length > 0) {
          formattedMessage = textBlocks
            .map(b => formatRecoveryMessage(b.content!, boleto, dueDate))
            .join('\n\n');
        } else {
          formattedMessage = formatRecoveryMessage(applicableRule.message, boleto, dueDate);
        }
      }

      return {
        ...boleto,
        dueDate,
        daysUntilDue,
        daysSinceGeneration,
        isOverdue,
        applicableRule,
        formattedMessage,
        contactedToday,
      };
    });
  }, [unpaidBoletos, settings, rules, contactedKeys, defaultTemplate]);

  // ── Derived lists ──
  const todayBoletos = useMemo(
    () => processedBoletos.filter((b) => b.applicableRule !== null),
    [processedBoletos]
  );

  const pendingTodayBoletos = useMemo(
    () => todayBoletos.filter((b) => !b.contactedToday),
    [todayBoletos]
  );

  const contactedTodayBoletos = useMemo(
    () => todayBoletos.filter((b) => b.contactedToday),
    [todayBoletos]
  );

  const pendingBoletos = useMemo(
    () => processedBoletos.filter((b) => !b.isOverdue),
    [processedBoletos]
  );

  const overdueBoletos = useMemo(
    () => processedBoletos.filter((b) => b.isOverdue),
    [processedBoletos]
  );

  // ── Stats ──
  const stats = useMemo(() => {
    const totalToday = todayBoletos.length;
    const contacted = contactedTodayBoletos.length;
    const pending = pendingTodayBoletos.length;
    const totalValue = todayBoletos.reduce((sum, b) => sum + Number(b.amount), 0);
    return {
      totalToday,
      contactedToday: contacted,
      pendingToday: pending,
      todayValue: totalValue,
      pendingCount: pendingBoletos.length,
      overdueCount: overdueBoletos.length,
      totalCount: processedBoletos.length,
    };
  }, [todayBoletos, contactedTodayBoletos, pendingTodayBoletos, pendingBoletos, overdueBoletos, processedBoletos]);

  // ── Manual contact mutation (writes to both boleto_recovery_contacts AND message_log) ──
  const addContact = useMutation({
    mutationFn: async ({ transactionId, ruleId, notes }: { transactionId: string; ruleId?: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      if (!ruleId) throw new Error("Rule ID is required for boleto contact");

      // Get transaction details for the message_log entry
      const boleto = processedBoletos.find(b => b.id === transactionId);
      const phone = boleto?.customer_phone?.replace(/\D/g, '') || '';

      // Write to message_log (source of truth)
      const { error: logError } = await supabase
        .from("message_log")
        .insert({
          phone: phone.startsWith('55') ? phone : `55${phone}`,
          message: boleto?.formattedMessage || 'Contato manual',
          message_type: 'boleto',
          status: 'sent',
          transaction_id: transactionId,
          rule_id: ruleId,
          sent_at: new Date().toISOString(),
        });
      if (logError) throw logError;

      // Also write to boleto_recovery_contacts for historical tracking
      const { error } = await supabase
        .from("boleto_recovery_contacts")
        .insert({
          transaction_id: transactionId,
          rule_id: ruleId,
          user_id: user.id,
          notes: notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boleto-today-logs"] });
    },
  });

  // ── Update settings mutation ──
  const updateSettings = useMutation({
    mutationFn: async (expirationDays: number) => {
      if (!settings?.id) {
        const { error } = await supabase.from("boleto_settings").insert({ default_expiration_days: expirationDays });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("boleto_settings").update({ default_expiration_days: expirationDays }).eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["boleto-settings"] }); },
  });

  return {
    settings,
    rules,
    processedBoletos,
    todayBoletos,
    pendingTodayBoletos,
    contactedTodayBoletos,
    pendingBoletos,
    overdueBoletos,
    stats,
    addContact,
    updateSettings,
    isLoading,
  };
}

function formatRecoveryMessage(template: string, boleto: Transaction, dueDate: Date): string {
  const firstName = boleto.customer_name?.split(" ")[0] || "Cliente";
  const formattedAmount = Number(boleto.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedDueDate = dueDate.toLocaleDateString("pt-BR");
  const barcode = boleto.external_id || "";
  return template
    .replace(/{saudação}/gi, getGreeting())
    .replace(/{nome}/gi, boleto.customer_name || "Cliente")
    .replace(/{primeiro_nome}/gi, firstName)
    .replace(/{valor}/gi, formattedAmount)
    .replace(/{vencimento}/gi, formattedDueDate)
    .replace(/{codigo_barras}/gi, barcode);
}
