import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Transaction } from "./useTransactions";
import { useMemo, useEffect, useState } from "react";
import { addDays, differenceInDays, isBefore, startOfDay, isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getGreeting } from "@/lib/greeting";

const BRAZIL_TIMEZONE = "America/Sao_Paulo";

// Helper to check if a date is "today" in Brazil timezone
function isTodayInBrazil(date: Date): boolean {
  const nowInBrazil = toZonedTime(new Date(), BRAZIL_TIMEZONE);
  const dateInBrazil = toZonedTime(date, BRAZIL_TIMEZONE);
  return isSameDay(nowInBrazil, dateInBrazil);
}

// Get start of today in Brazil timezone
function getTodayStartInBrazil(): Date {
  const nowInBrazil = toZonedTime(new Date(), BRAZIL_TIMEZONE);
  return startOfDay(nowInBrazil);
}

export interface BoletoSettings {
  id: string;
  default_expiration_days: number;
}

export interface RecoveryRule {
  id: string;
  name: string;
  rule_type: "days_after_generation" | "days_before_due" | "days_after_due";
  days: number;
  message: string;
  is_active: boolean;
  priority: number;
}

export interface RecoveryContact {
  id: string;
  transaction_id: string;
  rule_id: string | null;
  contacted_at: string;
  contact_method: string;
  notes: string | null;
  user_id: string;
}

export interface BoletoWithRecovery extends Transaction {
  dueDate: Date;
  daysUntilDue: number;
  daysSinceGeneration: number;
  isOverdue: boolean;
  applicableRule: RecoveryRule | null;
  formattedMessage: string | null;
  contacts: RecoveryContact[];
  shouldContactToday: boolean;
}

export function useBoletoRecovery(transactions: Transaction[]) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user id
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Fetch boleto settings
  const { data: settings } = useQuery({
    queryKey: ["boleto-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as BoletoSettings | null;
    },
  });

  // Fetch recovery rules
  const { data: rules } = useQuery({
    queryKey: ["boleto-recovery-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_recovery_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as RecoveryRule[];
    },
  });

  // Fetch all recovery contacts
  const { data: contacts } = useQuery({
    queryKey: ["boleto-recovery-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_recovery_contacts")
        .select("*")
        .order("contacted_at", { ascending: false });
      if (error) throw error;
      return data as RecoveryContact[];
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (expirationDays: number) => {
      if (!settings?.id) {
        const { error } = await supabase
          .from("boleto_settings")
          .insert({ default_expiration_days: expirationDays });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("boleto_settings")
          .update({ default_expiration_days: expirationDays })
          .eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boleto-settings"] });
    },
  });

  // Add contact mutation
  const addContact = useMutation({
    mutationFn: async ({ transactionId, ruleId, notes }: { transactionId: string; ruleId?: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      const { error } = await supabase
        .from("boleto_recovery_contacts")
        .insert({
          transaction_id: transactionId,
          rule_id: ruleId || null,
          user_id: user.id,
          notes: notes || null,
        });
      if (error) throw error;
      return transactionId;
    },
    onSuccess: (transactionId) => {
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-contacts"] });
      // Invalidate the specific boleto recovery icon count
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-count", transactionId] });
    },
  });

  // Process boletos with recovery info (exclude paid, canceled, expired)
  const processedBoletos = useMemo(() => {
    const unpaidBoletos = transactions.filter(
      (t) => t.type === "boleto" && !["pago", "cancelado", "expirado"].includes(t.status)
    );

      const expirationDays = settings?.default_expiration_days || 3;
      const today = getTodayStartInBrazil();

      return unpaidBoletos.map((boleto): BoletoWithRecovery => {
        // Convert created_at to Brazil timezone for accurate day calculations
        const createdAt = new Date(boleto.created_at);
        const createdAtInBrazil = toZonedTime(createdAt, BRAZIL_TIMEZONE);
        const createdAtDayStart = startOfDay(createdAtInBrazil);
        
        const dueDate = addDays(createdAtDayStart, expirationDays);
        const daysUntilDue = differenceInDays(dueDate, today);
        const daysSinceGeneration = differenceInDays(today, createdAtDayStart);
        const isOverdue = isBefore(dueDate, today);

      // Get contacts for this boleto
      const boletoContacts = contacts?.filter((c) => c.transaction_id === boleto.id) || [];

      // Find applicable rule
      let applicableRule: RecoveryRule | null = null;
      let shouldContactToday = false;

      if (rules && rules.length > 0) {
        for (const rule of rules) {
          let ruleMatches = false;

          if (rule.rule_type === "days_after_generation" && daysSinceGeneration === rule.days) {
            ruleMatches = true;
          } else if (rule.rule_type === "days_before_due" && daysUntilDue === rule.days) {
            ruleMatches = true;
          } else if (rule.rule_type === "days_after_due" && isOverdue && Math.abs(daysUntilDue) === rule.days) {
            ruleMatches = true;
          }

          if (ruleMatches) {
            // Check if already contacted today for this rule
            const contactedToday = boletoContacts.some(
              (c) => c.rule_id === rule.id && isTodayInBrazil(new Date(c.contacted_at))
            );

            if (!contactedToday) {
              applicableRule = rule;
              shouldContactToday = true;
              break;
            }
          }
        }
      }

      // Format message with variables
      let formattedMessage: string | null = null;
      if (applicableRule) {
        formattedMessage = formatRecoveryMessage(applicableRule.message, boleto, dueDate);
      }

      return {
        ...boleto,
        dueDate,
        daysUntilDue,
        daysSinceGeneration,
        isOverdue,
        applicableRule,
        formattedMessage,
        contacts: boletoContacts,
        shouldContactToday,
      };
    });
  }, [transactions, settings, rules, contacts]);

  // Filter boletos that match any rule today (for total count including contacted)
  const boletosMatchingRulesToday = useMemo(() => {
    if (!rules || rules.length === 0) return [];
    
    const today = getTodayStartInBrazil();
    const expirationDays = settings?.default_expiration_days || 3;
    
    return processedBoletos.filter((boleto) => {
      // Use same Brazil timezone calculation as processedBoletos
      const createdAt = new Date(boleto.created_at);
      const createdAtInBrazil = toZonedTime(createdAt, BRAZIL_TIMEZONE);
      const createdAtDayStart = startOfDay(createdAtInBrazil);
      
      const dueDate = addDays(createdAtDayStart, expirationDays);
      const daysUntilDue = differenceInDays(dueDate, today);
      const daysSinceGeneration = differenceInDays(today, createdAtDayStart);
      const isOverdue = isBefore(dueDate, today);
      
      // Check if any rule matches this boleto today
      return rules.some((rule) => {
        if (rule.rule_type === "days_after_generation" && daysSinceGeneration === rule.days) {
          return true;
        } else if (rule.rule_type === "days_before_due" && daysUntilDue === rule.days) {
          return true;
        } else if (rule.rule_type === "days_after_due" && isOverdue && Math.abs(daysUntilDue) === rule.days) {
          return true;
        }
        return false;
      });
    });
  }, [processedBoletos, rules, settings]);

  // Boletos that need to be contacted today (not yet contacted)
  const todayBoletos = useMemo(
    () => processedBoletos.filter((b) => b.shouldContactToday),
    [processedBoletos]
  );

  const pendingBoletos = useMemo(
    () => processedBoletos.filter((b) => !b.isOverdue),
    [processedBoletos]
  );

  const overdueBoletos = useMemo(
    () => processedBoletos.filter((b) => b.isOverdue),
    [processedBoletos]
  );

  // Stats
  const stats = useMemo(() => {
    // Total that match rules today (including already contacted)
    const totalMatchingToday = boletosMatchingRulesToday.length;
    const totalValue = boletosMatchingRulesToday.reduce((sum, b) => sum + Number(b.amount), 0);
    
    // Already contacted today
    const contactedToday = boletosMatchingRulesToday.filter((b) => 
      b.contacts.some((c) => isTodayInBrazil(new Date(c.contacted_at)))
    ).length;
    
    // Remaining to contact
    const remainingToContact = todayBoletos.length;

    return {
      todayCount: totalMatchingToday,
      todayValue: totalValue,
      contactedToday,
      remainingToContact,
      pendingCount: pendingBoletos.length,
      overdueCount: overdueBoletos.length,
      totalCount: processedBoletos.length,
    };
  }, [boletosMatchingRulesToday, todayBoletos, pendingBoletos, overdueBoletos, processedBoletos]);

  return {
    settings,
    rules,
    contacts,
    processedBoletos,
    todayBoletos,
    pendingBoletos,
    overdueBoletos,
    stats,
    updateSettings,
    addContact,
  };
}

function formatRecoveryMessage(template: string, boleto: Transaction, dueDate: Date): string {
  const firstName = boleto.customer_name?.split(" ")[0] || "Cliente";
  const formattedAmount = Number(boleto.amount).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
