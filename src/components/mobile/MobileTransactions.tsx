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
  MessageSquare
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import { toast } from "sonner";

const VIEWED_STORAGE_KEY = "viewed_transactions";
const VIEWED_ABANDONED_KEY = "viewed_abandoned_events";

type TabType = "todos" | "pagos" | "pendentes" | "abandonos";
type DateFilterType = "hoje" | "ontem" | "semana";

export function MobileTransactions() {
  const { transactions, isLoading, refetch } = useTransactions();
  const { events: abandonedEvents } = useAbandonedEvents();
  const [activeTab, setActiveTab] = useState<TabType>("todos");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("hoje");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mark ALL transactions as viewed on mount (fix badge issue)
  useEffect(() => {
    if (transactions.length > 0) {
      const paidIds = transactions.filter(t => t.status === "pago").map(t => t.id);
      const boletoGeradoIds = transactions.filter(t => t.type === "boleto" && t.status === "gerado").map(t => t.id);
      const pixCartaoPendenteIds = transactions.filter(t => (t.type === "pix" || t.type === "cartao") && t.status === "pendente").map(t => t.id);
      
      const stored = localStorage.getItem(VIEWED_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : { aprovados: [], "boletos-gerados": [], "pix-cartao-pendentes": [] };
      
      parsed.aprovados = [...new Set([...(parsed.aprovados || []), ...paidIds])];
      parsed["boletos-gerados"] = [...new Set([...(parsed["boletos-gerados"] || []), ...boletoGeradoIds])];
      parsed["pix-cartao-pendentes"] = [...new Set([...(parsed["pix-cartao-pendentes"] || []), ...pixCartaoPendenteIds])];
      
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(parsed));
    }
  }, [transactions]);

  // Also mark abandoned as viewed
  useEffect(() => {
    if (abandonedEvents.length > 0) {
      const allIds = abandonedEvents.map(e => e.id);
      localStorage.setItem(VIEWED_ABANDONED_KEY, JSON.stringify(allIds));
    }
  }, [abandonedEvents]);

  const getDateRange = (filter: DateFilterType) => {
    const now = new Date();
    switch (filter) {
      case "hoje":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "ontem":
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case "semana":
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    }
  };

  const filteredTransactions = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);
    
    let filtered = transactions.filter((t) => {
      const dateStr = t.status === "pago" && t.paid_at ? t.paid_at : t.created_at;
      const date = new Date(dateStr);
      return isWithinInterval(date, { start, end });
    });

    switch (activeTab) {
      case "pagos":
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
      const date = new Date(e.created_at);
      return isWithinInterval(date, { start, end });
    });
  }, [abandonedEvents, dateFilter, activeTab]);

  const counts = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);
    const dateFiltered = transactions.filter((t) => {
      const dateStr = t.status === "pago" && t.paid_at ? t.paid_at : t.created_at;
      const date = new Date(dateStr);
      return isWithinInterval(date, { start, end });
    });

    return {
      todos: dateFiltered.length,
      pagos: dateFiltered.filter(t => t.status === "pago").length,
      pendentes: dateFiltered.filter(t => t.status !== "pago").length,
      abandonos: abandonedEvents.filter(e => {
        const date = new Date(e.created_at);
        return isWithinInterval(date, { start, end });
      }).length,
    };
  }, [transactions, abandonedEvents, dateFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "pix": return QrCode;
      case "boleto": return FileText;
      case "cartao": return CreditCard;
      default: return FileText;
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

  // Tab colors config
  const getTabStyle = (tab: TabType, isActive: boolean) => {
    if (!isActive) return "bg-secondary text-muted-foreground";
    switch (tab) {
      case "pagos":
        return "bg-success/20 text-success border border-success/30";
      case "pendentes":
        return "bg-warning/20 text-warning border border-warning/30";
      case "abandonos":
        return "bg-destructive/20 text-destructive border border-destructive/30";
      default:
        return "bg-primary text-primary-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 space-y-2 bg-background min-h-full">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/98 backdrop-blur-xl px-3 pt-2 pb-2 space-y-2 border-b border-border">
        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5">
          {(["hoje", "ontem", "semana"] as DateFilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all",
                dateFilter === filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {filter === "hoje" ? "Hoje" : filter === "ontem" ? "Ontem" : "7d"}
            </button>
          ))}
          <button 
            onClick={handleRefresh}
            className="ml-auto p-1.5 rounded-full bg-secondary text-muted-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 rounded-lg bg-secondary border-border text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Tab Pills - Compact */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
          {(["todos", "pagos", "pendentes", "abandonos"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all",
                getTabStyle(tab, activeTab === tab)
              )}
            >
              <span className="capitalize">{tab === "abandonos" ? "Aband." : tab}</span>
              <span className={cn(
                "min-w-[14px] h-[14px] px-0.5 rounded text-[9px] font-bold flex items-center justify-center",
                activeTab === tab ? "bg-black/10" : "bg-card"
              )}>
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-auto px-3 py-2 space-y-1.5">
        {activeTab === "abandonos" ? (
          filteredAbandoned.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Nenhum abandono</p>
            </div>
          ) : (
            filteredAbandoned.map((event) => (
              <div 
                key={event.id}
                className="bg-card border-l-2 border-l-destructive rounded-lg p-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex-shrink-0 flex items-center justify-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {event.customer_name || "Sem nome"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {formatTime(event.created_at)} • {event.event_type === "cart_abandoned" ? "Carrinho" : "Falha"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <p className="text-xs font-bold text-destructive">
                      {event.amount ? formatCurrency(event.amount) : "-"}
                    </p>
                    {event.customer_phone && (
                      <button
                        onClick={() => openWhatsAppBusiness(event.customer_phone)}
                        className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center text-success"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Nenhuma transação</p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const Icon = getTypeIcon(transaction.type);
              const isPaid = transaction.status === "pago";
              const displayDate = isPaid && transaction.paid_at ? transaction.paid_at : transaction.created_at;
              
              return (
                <div 
                  key={transaction.id}
                  className={cn(
                    "bg-card border-l-2 rounded-lg p-2.5",
                    isPaid ? "border-l-success" : "border-l-warning"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center",
                      isPaid ? "bg-success/10" : "bg-warning/10"
                    )}>
                      <Icon className={cn(
                        "h-3.5 w-3.5",
                        isPaid ? "text-success" : "text-warning"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {transaction.customer_name || "Cliente"}
                      </p>
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <span className="uppercase">{transaction.type}</span>
                        <span>•</span>
                        <span>{formatTime(displayDate)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="text-right">
                        <p className={cn(
                          "text-xs font-bold",
                          isPaid ? "text-success" : "text-foreground"
                        )}>
                          {formatCurrency(Number(transaction.amount))}
                        </p>
                        <span className={cn(
                          "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-semibold",
                          isPaid 
                            ? "bg-success/15 text-success" 
                            : "bg-warning/15 text-warning"
                        )}>
                          {isPaid ? <CheckCircle2 className="h-2 w-2" /> : <Clock className="h-2 w-2" />}
                          {isPaid ? "Pago" : "Pend."}
                        </span>
                      </div>
                      {!isPaid && transaction.customer_phone && (
                        <button
                          onClick={() => openWhatsAppBusiness(transaction.customer_phone)}
                          className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center text-success"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
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