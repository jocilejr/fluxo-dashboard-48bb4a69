import { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Transaction } from "@/hooks/useTransactions";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Download, Search, ChevronDown, ChevronUp, Users, Clock, CheckCircle2, AlertCircle, RefreshCw, CalendarIcon, MessageSquare, Settings2, ShoppingCart, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BoletoRecoveryModal } from "./BoletoRecoveryModal";
import { BoletoQuickRecovery } from "./BoletoQuickRecovery";
import { BoletoRecoveryIcon } from "./BoletoRecoveryIcon";
import { PixCardQuickRecovery } from "./PixCardQuickRecovery";
import { PixCardRecoverySettings } from "./PixCardRecoverySettings";
import { AbandonedEventsTab } from "./AbandonedEventsTab";
import { useAbandonedEvents } from "@/hooks/useAbandonedEvents";
import { RecoveryStatusIndicator } from "./RecoveryStatusIndicator";
import { PhoneValidationIndicator } from "./PhoneValidationIndicator";
import { useTransactionRecoveryLogs } from "@/hooks/useTransactionRecoveryLogs";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";

interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onDelete?: () => void;
  isAdmin?: boolean;
}

type TransactionDateFilterType = "today" | "yesterday" | "7days" | "30days" | "custom";

interface TransactionDateFilter {
  type: TransactionDateFilterType;
  startDate: Date;
  endDate: Date;
}

const typeLabels = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
};

const statusStyles = {
  pago: "bg-success/20 text-success border-success/30",
  gerado: "bg-info/20 text-info border-info/30",
  pendente: "bg-warning/20 text-warning border-warning/30",
  cancelado: "bg-destructive/20 text-destructive border-destructive/30",
  expirado: "bg-muted/50 text-muted-foreground border-muted/50",
};

const statusLabels = {
  pago: "Pago",
  gerado: "Gerado",
  pendente: "Pendente",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const typeStyles = {
  boleto: "bg-info/20 text-info border-info/30",
  pix: "bg-success/20 text-success border-success/30",
  cartao: "bg-chart-4/20 text-chart-4 border-chart-4/30",
};

const VIEWED_STORAGE_KEY = "viewed_transactions";
const VIEWED_ABANDONED_KEY = "viewed_abandoned_events";

type TransactionTabKey = "aprovados" | "boletos-gerados" | "pix-cartao-pendentes";
type TabKey = TransactionTabKey | "abandono-falha";
type SortField = "created_at" | "amount" | "customer_name";
type SortDirection = "asc" | "desc";

const isTransactionTab = (tab: TabKey): tab is TransactionTabKey => tab !== "abandono-falha";

export function TransactionsTable({ transactions, isLoading, onDelete, isAdmin = false }: TransactionsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("aprovados");
  const { events: abandonedEvents } = useAbandonedEvents();
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(15);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [quickRecoveryOpen, setQuickRecoveryOpen] = useState(false);
  const [templateSettingsOpen, setTemplateSettingsOpen] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<Transaction | null>(null);
  
  // Get transaction IDs for recovery logs
  const transactionIds = useMemo(() => transactions.map(t => t.id), [transactions]);
  const { logs: recoveryLogs, isLoading: recoveryLogsLoading } = useTransactionRecoveryLogs(transactionIds);
  
  // Debug log for recovery logs
  console.log('[TransactionsTable] Recovery logs state:', {
    transactionCount: transactions.length,
    logsCount: Object.keys(recoveryLogs).length,
    isLoading: recoveryLogsLoading,
    sampleLogs: Object.entries(recoveryLogs).slice(0, 2)
  });
  
  // Get phone numbers for automatic validation
  const phoneNumbers = useMemo(() => transactions.map(t => t.customer_phone), [transactions]);
  const { getValidationStatus } = usePhoneValidation(phoneNumbers);
  
  // Helper to get current date in Brazil timezone
  const getBrazilNow = useCallback((): Date => {
    const brazilDateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    return new Date(brazilDateStr);
  }, []);

  // Transaction date filter state
  const [dateFilter, setDateFilter] = useState<TransactionDateFilter>(() => {
    const brazilDateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const now = new Date(brazilDateStr);
    return {
      type: "today",
      startDate: startOfDay(now),
      endDate: endOfDay(now),
    };
  });
  
  const [viewedIds, setViewedIds] = useState<Record<TabKey, string[]>>(() => {
    try {
      const stored = localStorage.getItem(VIEWED_STORAGE_KEY);
      const abandonedStored = localStorage.getItem(VIEWED_ABANDONED_KEY);
      const base = stored ? JSON.parse(stored) : { aprovados: [], "boletos-gerados": [], "pix-cartao-pendentes": [] };
      return {
        ...base,
        "abandono-falha": abandonedStored ? JSON.parse(abandonedStored) : [],
      };
    } catch {
      return { aprovados: [], "boletos-gerados": [], "pix-cartao-pendentes": [], "abandono-falha": [] };
    }
  });

  const handleDatePreset = (type: TransactionDateFilterType) => {
    const now = getBrazilNow();
    let startDate: Date;
    let endDate = endOfDay(now);

    switch (type) {
      case "today":
        startDate = startOfDay(now);
        break;
      case "yesterday":
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case "7days":
        startDate = startOfDay(subDays(now, 6));
        break;
      case "30days":
        startDate = startOfDay(subDays(now, 29));
        break;
      default:
        startDate = startOfDay(now);
    }

    setDateFilter({ type, startDate, endDate });
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      setDateFilter({
        type: "custom",
        startDate: startOfDay(range.from),
        endDate: endOfDay(range.to),
      });
      setIsCalendarOpen(false);
    }
  };

  // Filter transactions by date first using Brazil timezone (same logic as Dashboard)
  // For paid transactions, use paid_at date; for others, use created_at
  const dateFilteredTransactions = useMemo(() => {
    const transactionToBrazilDate = (utcDateStr: string) => {
      return new Date(utcDateStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    };
    
    const extractDateParts = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const startDateStr = extractDateParts(dateFilter.startDate);
    const endDateStr = extractDateParts(dateFilter.endDate);
    
    return transactions.filter((t) => {
      // For paid transactions, use paid_at if available, otherwise use created_at
      const dateStr = t.status === "pago" && t.paid_at ? t.paid_at : t.created_at;
      const transactionDateStr = transactionToBrazilDate(dateStr);
      return transactionDateStr >= startDateStr && transactionDateStr <= endDateStr;
    });
  }, [transactions, dateFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR') + ' ' + date.toLocaleDateString('pt-BR');
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  // Get transactions for each tab (filtered by date)
  const tabTransactions = useMemo(() => ({
    aprovados: dateFilteredTransactions.filter(t => t.status === "pago"),
    "boletos-gerados": dateFilteredTransactions.filter(t => t.type === "boleto" && t.status === "gerado"),
    "pix-cartao-pendentes": dateFilteredTransactions.filter(t => (t.type === "pix" || t.type === "cartao") && t.status === "pendente"),
  }), [dateFilteredTransactions]);

  // Calculate stats for current tab
  const tabStats = useMemo(() => {
    if (!isTransactionTab(activeTab)) {
      return { totalAmount: 0, uniqueCustomers: 0, todayCount: 0, total: 0 };
    }
    const currentTransactions = tabTransactions[activeTab] || [];
    const totalAmount = currentTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const uniqueCustomers = new Set(currentTransactions.filter(t => t.customer_name).map(t => t.customer_name)).size;
    const todayCount = currentTransactions.filter(t => {
      const date = new Date(t.created_at);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }).length;

    return { totalAmount, uniqueCustomers, todayCount, total: currentTransactions.length };
  }, [tabTransactions, activeTab]);

  // Calculate unviewed counts for each tab
  const unviewedCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      aprovados: 0,
      "boletos-gerados": 0,
      "pix-cartao-pendentes": 0,
      "abandono-falha": 0,
    };
    
    (Object.keys(tabTransactions) as (keyof typeof tabTransactions)[]).forEach((tab) => {
      const tabTxIds = tabTransactions[tab].map(t => t.id);
      const viewedInTab = viewedIds[tab] || [];
      counts[tab] = tabTxIds.filter(id => !viewedInTab.includes(id)).length;
    });

    // Calculate abandoned events unviewed count
    const abandonedViewedIds = viewedIds["abandono-falha"] || [];
    counts["abandono-falha"] = abandonedEvents.filter(e => !abandonedViewedIds.includes(e.id)).length;
    
    return counts;
  }, [tabTransactions, viewedIds, abandonedEvents]);

  // Mark current tab's transactions as viewed
  const markAsViewed = useCallback((tab: TabKey) => {
    if (!isTransactionTab(tab)) {
      // Handle abandoned events separately
      const abandonedIds = abandonedEvents.map(e => e.id);
      setViewedIds(prev => {
        const updated = {
          ...prev,
          "abandono-falha": [...new Set([...(prev["abandono-falha"] || []), ...abandonedIds])],
        };
        localStorage.setItem(VIEWED_ABANDONED_KEY, JSON.stringify(updated["abandono-falha"]));
        return updated;
      });
      return;
    }
    
    const tabTxIds = tabTransactions[tab].map(t => t.id);
    
    setViewedIds(prev => {
      const updated = {
        ...prev,
        [tab]: [...new Set([...(prev[tab] || []), ...tabTxIds])],
      };
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify({
        aprovados: updated.aprovados,
        "boletos-gerados": updated["boletos-gerados"],
        "pix-cartao-pendentes": updated["pix-cartao-pendentes"],
      }));
      return updated;
    });
  }, [tabTransactions, abandonedEvents]);

  // Mark as viewed when tab changes or transactions load
  useEffect(() => {
    if (!isTransactionTab(activeTab)) {
      if (abandonedEvents.length > 0) {
        markAsViewed(activeTab);
      }
    } else if (tabTransactions[activeTab]?.length > 0) {
      markAsViewed(activeTab);
    }
  }, [activeTab, tabTransactions, abandonedEvents, markAsViewed]);

  // Reset visible count when tab changes
  useEffect(() => {
    setVisibleCount(15);
  }, [activeTab]);

  // Filter transactions by active tab
  const tabFilteredTransactions = isTransactionTab(activeTab) ? tabTransactions[activeTab] : [];

  // Apply search filter and sorting
  const filteredTransactions = useMemo(() => {
    let result = tabFilteredTransactions;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((t) => {
        const customerName = t.customer_name?.toLowerCase() || "";
        const customerPhone = t.customer_phone?.toLowerCase() || "";
        const customerEmail = t.customer_email?.toLowerCase() || "";
        const externalId = t.external_id?.toLowerCase() || "";
        const date = formatDate(t.created_at).toLowerCase();
        
        return (
          customerName.includes(query) ||
          customerPhone.includes(query) ||
          customerEmail.includes(query) ||
          externalId.includes(query) ||
          date.includes(query)
        );
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case "amount":
          aVal = Number(a.amount);
          bVal = Number(b.amount);
          break;
        case "customer_name":
          aVal = a.customer_name || "";
          bVal = b.customer_name || "";
          break;
        default:
          // For paid transactions, use paid_at; for others, use created_at
          const aDateStr = a.status === "pago" && a.paid_at ? a.paid_at : a.created_at;
          const bDateStr = b.status === "pago" && b.paid_at ? b.paid_at : b.created_at;
          aVal = new Date(aDateStr).getTime();
          bVal = new Date(bDateStr).getTime();
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [tabFilteredTransactions, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const queryClient = useQueryClient();

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Transação removida");
      onDelete?.();
      // Invalidate customers to sync unified data
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-events"] });
    } catch (error: any) {
      toast.error("Erro ao remover transação");
      console.error(error);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabKey);
  };

  const handleBoletoClick = (transaction: Transaction) => {
    if (transaction.type === "boleto" && transaction.status === "gerado") {
      setSelectedBoleto(transaction);
      setQuickRecoveryOpen(true);
    }
  };

  const handleOpenTemplateSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateSettingsOpen(true);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? 
      <ChevronUp className="h-3.5 w-3.5 ml-1 inline" /> : 
      <ChevronDown className="h-3.5 w-3.5 ml-1 inline" />;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-slide-up" style={{ animationDelay: "400ms" }}>
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const renderMobileView = () => (
    <div className="block sm:hidden space-y-3">
      {filteredTransactions.slice(0, 10).map((transaction) => (
        <div 
          key={transaction.id} 
          className={cn(
            "border border-border/30 rounded-lg p-3 bg-secondary/10",
            transaction.type === "boleto" && transaction.status === "gerado" && "cursor-pointer border-primary/30 hover:bg-primary/5"
          )}
          onClick={() => handleBoletoClick(transaction)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("font-medium text-xs", typeStyles[transaction.type])}>
                {typeLabels[transaction.type]}
              </Badge>
              {transaction.type === "boleto" && transaction.status === "gerado" && (
                <BoletoRecoveryIcon transaction={transaction} />
              )}
            </div>
            <Badge variant="outline" className={cn("font-medium text-xs", statusStyles[transaction.status])}>
              {statusLabels[transaction.status]}
            </Badge>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate max-w-[60%]">
              {transaction.customer_name || '-'}
            </span>
            <span className="text-sm font-bold">{formatCurrency(Number(transaction.amount))}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(transaction.type === "boleto" && transaction.status === "pago" && transaction.paid_at ? transaction.paid_at : transaction.created_at)}</span>
            <div className="flex items-center gap-1">
              {transaction.type === 'boleto' && transaction.metadata?.boleto_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => window.open(transaction.metadata!.boleto_url, '_blank')}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] rounded-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover transação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(transaction.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDesktopView = () => (
    <div className="hidden sm:block">
      {/* Quick Stats Bar - Admin only */}
      {isAdmin && (
        <div className="grid grid-cols-4 gap-3 mb-5 p-4 bg-secondary/20 rounded-lg border border-border/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-semibold">{tabStats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <AlertCircle className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-sm font-semibold">{formatCurrency(tabStats.totalAmount)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <Users className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-sm font-semibold">{tabStats.uniqueCustomers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-sm font-semibold">{tabStats.todayCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border/30">
        <table className="w-full">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tipo
              </th>
              <th 
                className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("customer_name")}
              >
                Cliente <SortIcon field="customer_name" />
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                Contato
              </th>
              <th 
                className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("created_at")}
              >
                Data <SortIcon field="created_at" />
              </th>
              <th 
                className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("amount")}
              >
                Valor <SortIcon field="amount" />
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  {searchQuery ? (
                    <div>
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Nenhuma transação encontrada</p>
                      <p className="text-sm">Tente buscar com outros termos</p>
                    </div>
                  ) : (
                    <div>
                      <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Nenhuma transação ainda</p>
                      <p className="text-sm">As transações aparecerão aqui quando chegarem</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredTransactions.slice(0, visibleCount).map((transaction, index) => (
                <tr 
                  key={transaction.id} 
                  className={cn(
                    "group hover:bg-secondary/40 transition-all duration-200 animate-fade-in",
                    transaction.type === "boleto" && transaction.status === "gerado" && "cursor-pointer hover:bg-primary/5"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => handleBoletoClick(transaction)}
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("font-medium text-xs", typeStyles[transaction.type])}>
                        {typeLabels[transaction.type]}
                      </Badge>
                      {transaction.type === "boleto" && transaction.status === "gerado" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <BoletoRecoveryIcon transaction={transaction} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Clique para recuperação</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {transaction.customer_name || '-'}
                      </span>
                      {transaction.customer_email && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {transaction.customer_email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {transaction.customer_phone || '-'}
                      </span>
                      {transaction.customer_phone && (() => {
                        const validationStatus = getValidationStatus(transaction.customer_phone);
                        return (
                          <PhoneValidationIndicator 
                            status={validationStatus?.status || null}
                            errorMessage={validationStatus?.result?.error}
                          />
                        );
                      })()}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col cursor-help">
                            {/* Para boletos pagos, mostrar data do pagamento; senão, data de criação */}
                            {transaction.type === "boleto" && transaction.status === "pago" && transaction.paid_at ? (
                              <>
                                <span className="text-sm font-medium">{formatRelativeTime(transaction.paid_at)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(transaction.paid_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-sm font-medium">{formatRelativeTime(transaction.created_at)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(transaction.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {transaction.type === "boleto" ? (
                            <div className="space-y-1">
                              <p><span className="text-muted-foreground">Gerado:</span> {formatDate(transaction.created_at)}</p>
                              {transaction.paid_at && (
                                <p><span className="text-muted-foreground">Pago:</span> {formatDate(transaction.paid_at)}</p>
                              )}
                            </div>
                          ) : (
                            <p>{formatDate(transaction.created_at)}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="text-sm font-bold">{formatCurrency(Number(transaction.amount))}</span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Badge variant="outline" className={cn("font-medium text-xs", statusStyles[transaction.status])}>
                        {statusLabels[transaction.status]}
                      </Badge>
                      {(() => {
                        const recoveryLog = recoveryLogs[transaction.id];
                        return (
                          <RecoveryStatusIndicator 
                            status={recoveryLog?.status || null}
                            errorMessage={recoveryLog?.error_message}
                            sentAt={recoveryLog?.sent_at}
                            isLoading={recoveryLogsLoading}
                          />
                        );
                      })()}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      {transaction.type === 'boleto' && transaction.metadata?.boleto_url && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(transaction.metadata!.boleto_url, '_blank');
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Baixar boleto</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(transaction.type === 'pix' || transaction.type === 'cartao') && transaction.status === 'pendente' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <PixCardQuickRecovery transaction={transaction} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Recuperação rápida</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remover</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover transação?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover esta transação? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(transaction.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Load More */}
        {filteredTransactions.length > visibleCount && (
          <div className="p-3 border-t border-border/30 bg-secondary/10 text-center">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setVisibleCount(prev => prev + 15)}
              className="text-xs"
            >
              Carregar mais ({filteredTransactions.length - visibleCount} restantes)
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderTabTrigger = (value: TabKey, label: string) => {
    const count = unviewedCounts[value];
    return (
      <TabsTrigger value={value} className="relative text-[10px] sm:text-xs py-2 px-1.5 sm:px-3 whitespace-nowrap">
        {label}
        {count > 0 && (
          <span className="absolute -top-1 -right-0.5 sm:-top-2 sm:-right-2 min-w-[16px] h-[16px] sm:min-w-[20px] sm:h-[20px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] sm:text-xs font-bold animate-pulse">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </TabsTrigger>
    );
  };

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6 animate-slide-up" style={{ animationDelay: "400ms" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold">Transações Recentes</h3>
        <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
          Mostrando {Math.min(visibleCount, filteredTransactions.length)} de {filteredTransactions.length}
        </span>
      </div>

      {/* Transaction Date Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <Button
          variant={dateFilter.type === "today" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDatePreset("today")}
          className="h-8 shrink-0 text-xs"
        >
          Hoje
        </Button>
        <Button
          variant={dateFilter.type === "yesterday" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDatePreset("yesterday")}
          className="h-8 shrink-0 text-xs"
        >
          Ontem
        </Button>
        <Button
          variant={dateFilter.type === "7days" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDatePreset("7days")}
          className="h-8 shrink-0 text-xs"
        >
          7 dias
        </Button>
        <Button
          variant={dateFilter.type === "30days" ? "default" : "outline"}
          size="sm"
          onClick={() => handleDatePreset("30days")}
          className="h-8 shrink-0 text-xs"
        >
          30 dias
        </Button>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={dateFilter.type === "custom" ? "default" : "outline"}
              size="sm"
              className={cn("h-8 gap-2 shrink-0 text-xs", dateFilter.type === "custom" && "min-w-[140px]")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFilter.type === "custom" ? (
                <span>
                  {format(dateFilter.startDate, "dd/MM", { locale: ptBR })} - {format(dateFilter.endDate, "dd/MM", { locale: ptBR })}
                </span>
              ) : (
                <span>Personalizado</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={customRange?.from}
              selected={customRange}
              onSelect={handleCustomRangeSelect}
              numberOfMonths={1}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-1 h-auto p-1">
            {renderTabTrigger("aprovados", "Aprovados")}
            {renderTabTrigger("boletos-gerados", "Boletos Ger.")}
            {renderTabTrigger("pix-cartao-pendentes", "PIX/Cartão Pend.")}
            {renderTabTrigger("abandono-falha", "Abandono/Falha")}
          </TabsList>
          {activeTab === "boletos-gerados" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 hidden sm:flex"
                    onClick={() => setTemplateSettingsOpen(true)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configurar templates de recuperação</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {activeTab === "pix-cartao-pendentes" && (
            <div className="hidden sm:block">
              <PixCardRecoverySettings />
            </div>
          )}
        </div>
      </Tabs>

      {activeTab === "abandono-falha" ? (
        <AbandonedEventsTab isAdmin={isAdmin} />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, email ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
          
          {renderMobileView()}
          {renderDesktopView()}
        </>
      )}

      <BoletoQuickRecovery
        open={quickRecoveryOpen}
        onOpenChange={setQuickRecoveryOpen}
        transaction={selectedBoleto}
        onTransactionUpdate={onDelete}
      />

      <BoletoRecoveryModal
        open={templateSettingsOpen}
        onOpenChange={setTemplateSettingsOpen}
      />
    </div>
  );
}
