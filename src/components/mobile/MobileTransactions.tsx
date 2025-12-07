import { useState, useMemo, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useAbandonedEvents } from "@/hooks/useAbandonedEvents";
import { cn } from "@/lib/utils";
import { 
  Search, 
  QrCode, 
  FileText, 
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  TrendingUp
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const VIEWED_STORAGE_KEY = "viewed_transactions";
const VIEWED_ABANDONED_KEY = "viewed_abandoned_events";

type TabType = "aprovados" | "pendentes" | "abandonos";
type DateFilterType = "hoje" | "ontem" | "semana";

export function MobileTransactions() {
  const { transactions, isLoading, refetch } = useTransactions();
  const { events: abandonedEvents } = useAbandonedEvents();
  const [activeTab, setActiveTab] = useState<TabType>("aprovados");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("hoje");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mark transactions as viewed on mount
  useEffect(() => {
    if (transactions.length > 0) {
      const paidIds = transactions.filter(t => t.status === "pago").map(t => t.id);
      const pendingIds = transactions.filter(t => t.status !== "pago").map(t => t.id);
      
      const stored = localStorage.getItem(VIEWED_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : { aprovados: [], pendentes: [] };
      
      parsed.aprovados = [...new Set([...(parsed.aprovados || []), ...paidIds])];
      parsed.pendentes = [...new Set([...(parsed.pendentes || []), ...pendingIds])];
      
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(parsed));
    }
  }, [transactions]);

  useEffect(() => {
    if (abandonedEvents.length > 0) {
      const allIds = abandonedEvents.map(e => e.id);
      localStorage.setItem(VIEWED_ABANDONED_KEY, JSON.stringify(allIds));
    }
  }, [abandonedEvents]);

  const getDateRange = (filter: DateFilterType) => {
    const nowBrazil = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    switch (filter) {
      case "hoje":
        return { start: startOfDay(nowBrazil), end: endOfDay(nowBrazil) };
      case "ontem":
        return { start: startOfDay(subDays(nowBrazil, 1)), end: endOfDay(subDays(nowBrazil, 1)) };
      case "semana":
        return { start: startOfDay(subDays(nowBrazil, 6)), end: endOfDay(nowBrazil) };
    }
  };

  const filteredTransactions = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);
    
    let filtered = transactions.filter((t) => {
      const dateStr = t.status === "pago" && t.paid_at ? t.paid_at : t.created_at;
      const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return isWithinInterval(date, { start, end });
    });

    switch (activeTab) {
      case "aprovados":
        filtered = filtered.filter(t => t.status === "pago");
        break;
      case "pendentes":
        filtered = filtered.filter(t => t.status !== "pago");
        break;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.customer_name?.toLowerCase().includes(query) ||
        t.customer_phone?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [transactions, dateFilter, activeTab, searchQuery]);

  const filteredAbandoned = useMemo(() => {
    if (activeTab !== "abandonos") return [];
    const { start, end } = getDateRange(dateFilter);
    
    return abandonedEvents.filter((e) => {
      const date = new Date(new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return isWithinInterval(date, { start, end });
    });
  }, [abandonedEvents, dateFilter, activeTab]);

  const counts = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);
    const dateFiltered = transactions.filter((t) => {
      const dateStr = t.status === "pago" && t.paid_at ? t.paid_at : t.created_at;
      const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return isWithinInterval(date, { start, end });
    });

    const abandonedFiltered = abandonedEvents.filter(e => {
      const date = new Date(new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return isWithinInterval(date, { start, end });
    });

    return {
      aprovados: dateFiltered.filter(t => t.status === "pago").length,
      pendentes: dateFiltered.filter(t => t.status !== "pago").length,
      abandonos: abandonedFiltered.length,
    };
  }, [transactions, abandonedEvents, dateFilter]);

  const totalRevenue = useMemo(() => {
    return filteredTransactions
      .filter(t => t.status === "pago")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [filteredTransactions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return format(date, "HH:mm", { locale: ptBR });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return format(date, "dd/MM", { locale: ptBR });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "pix": return QrCode;
      case "boleto": return FileText;
      case "cartao": return CreditCard;
      default: return FileText;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "pix": return "PIX";
      case "boleto": return "Boleto";
      case "cartao": return "Cartão";
      default: return type;
    }
  };

  const openWhatsAppBusiness = (phone: string | null) => {
    if (!phone) {
      toast.error("Sem telefone");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://api.whatsapp.com/send?phone=${fullPhone}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 bg-background min-h-full">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 pt-3 pb-3 space-y-3">
        {/* Date Filter & Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(["hoje", "ontem", "semana"] as DateFilterType[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  dateFilter === filter
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground"
                )}
              >
                {filter === "hoje" ? "Hoje" : filter === "ontem" ? "Ontem" : "7 dias"}
              </button>
            ))}
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-secondary/50 text-muted-foreground"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-secondary/30 border-border/50 text-sm"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {(["aprovados", "pendentes", "abandonos"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const count = counts[tab];
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all border",
                  isActive 
                    ? tab === "aprovados" 
                      ? "bg-success/10 text-success border-success/30"
                      : tab === "pendentes"
                        ? "bg-warning/10 text-warning border-warning/30"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-secondary/30 text-muted-foreground border-transparent"
                )}
              >
                <span className="capitalize">{tab}</span>
                <span className={cn(
                  "min-w-[18px] h-[18px] px-1 rounded text-[10px] font-bold flex items-center justify-center",
                  isActive ? "bg-background/50" : "bg-card"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Revenue Summary for Aprovados */}
      {activeTab === "aprovados" && totalRevenue > 0 && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Total do período</p>
                <p className="text-sm font-bold text-success">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{counts.aprovados} vendas</p>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {activeTab === "abandonos" ? (
          filteredAbandoned.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Nenhum abandono encontrado</p>
            </div>
          ) : (
            filteredAbandoned.map((event) => (
              <div 
                key={event.id}
                className="bg-card rounded-xl p-4 border border-border/50"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 flex-shrink-0 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {event.customer_name || "Cliente não identificado"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.event_type === "cart_abandoned" ? "Carrinho abandonado" : "Falha no pagamento"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-destructive">
                          {event.amount ? formatCurrency(event.amount) : "-"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTime(event.created_at)} • {formatDate(event.created_at)}
                        </p>
                      </div>
                    </div>
                    {event.customer_phone && (
                      <button
                        onClick={() => openWhatsAppBusiness(event.customer_phone)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Recuperar via WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Nenhuma transação encontrada</p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const Icon = getTypeIcon(transaction.type);
              const isPaid = transaction.status === "pago";
              const displayDate = isPaid && transaction.paid_at ? transaction.paid_at : transaction.created_at;
              
              return (
                <div 
                  key={transaction.id}
                  className="bg-card rounded-xl p-4 border border-border/50"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center",
                      isPaid ? "bg-success/10" : "bg-warning/10"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        isPaid ? "text-success" : "text-warning"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {transaction.customer_name || "Cliente"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold",
                              isPaid 
                                ? "bg-success/10 text-success" 
                                : "bg-warning/10 text-warning"
                            )}>
                              {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {isPaid ? "Pago" : "Pendente"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {getTypeLabel(transaction.type)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn(
                            "text-sm font-bold",
                            isPaid ? "text-success" : "text-foreground"
                          )}>
                            {formatCurrency(Number(transaction.amount))}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatTime(displayDate)} • {formatDate(displayDate)}
                          </p>
                        </div>
                      </div>
                      {!isPaid && transaction.customer_phone && (
                        <button
                          onClick={() => openWhatsAppBusiness(transaction.customer_phone)}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Recuperar via WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}