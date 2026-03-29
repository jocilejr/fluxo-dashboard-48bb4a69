import { useState, useMemo, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useAbandonedEvents } from "@/hooks/useAbandonedEvents";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getGreeting } from "@/lib/greeting";
import { 
  Search, 
  QrCode, 
  FileText, 
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  MessageCircle,
  TrendingUp,
  ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  // Fetch recovery messages
  const [pixCardMessage, setPixCardMessage] = useState("");
  const [abandonedMessage, setAbandonedMessage] = useState("");

  useEffect(() => {
    const fetchMessages = async () => {
      const [pixRes, abandRes] = await Promise.all([
        supabase.from("pix_card_recovery_settings").select("message").maybeSingle(),
        supabase.from("abandoned_recovery_settings").select("message").maybeSingle(),
      ]);
      if (pixRes.data?.message) setPixCardMessage(pixRes.data.message);
      if (abandRes.data?.message) setAbandonedMessage(abandRes.data.message);
    };
    fetchMessages();
  }, []);

  const formatRecoveryMessage = (template: string, name: string | null, amount: number | null) => {
    const firstName = name?.split(" ")[0] || "";
    return template
      .replace(/{saudação}/g, getGreeting())
      .replace(/{saudacao}/g, getGreeting())
      .replace(/{nome}/g, name || "")
      .replace(/{primeiro_nome}/g, firstName)
      .replace(/{valor}/g, amount ? formatCurrency(amount) : "");
  };

  const openWhatsAppBusiness = (phone: string | null, name?: string | null, amount?: number | null, type?: "transaction" | "abandoned") => {
    if (!phone) {
      toast.error("Sem telefone");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const template = type === "abandoned" ? abandonedMessage : pixCardMessage;
    const message = template ? formatRecoveryMessage(template, name || null, amount || null) : "";
    const textParam = message ? `&text=${encodeURIComponent(message)}` : "";
    
    window.open(`https://api.whatsapp.com/send?phone=${fullPhone}${textParam}`, '_blank');
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
      {/* Header fixo */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 pt-3 pb-3 space-y-3">
        {/* Filtros de data e refresh */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {(["hoje", "ontem", "semana"] as DateFilterType[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium transition-all",
                  dateFilter === filter
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {filter === "hoje" ? "Hoje" : filter === "ontem" ? "Ontem" : "7 dias"}
              </button>
            ))}
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-lg bg-secondary/50 text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-secondary/30 border-border/30 text-sm"
          />
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2">
          {(["aprovados", "pendentes", "abandonos"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const count = counts[tab];
            const colors = {
              aprovados: { active: "bg-success/10 text-success border-success/30", badge: "bg-success/20" },
              pendentes: { active: "bg-warning/10 text-warning border-warning/30", badge: "bg-warning/20" },
              abandonos: { active: "bg-destructive/10 text-destructive border-destructive/30", badge: "bg-destructive/20" },
            };
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border",
                  isActive 
                    ? colors[tab].active
                    : "bg-card text-muted-foreground border-border/30"
                )}
              >
                <span className="capitalize text-[11px]">
                  {tab === "aprovados" ? "Aprovados" : tab === "pendentes" ? "Pendentes" : "Abandonos"}
                </span>
                <span className={cn(
                  "min-w-[24px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                  isActive ? "bg-background/60" : "bg-secondary/50"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumo de receita para aprovados */}
      {activeTab === "aprovados" && totalRevenue > 0 && (
        <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-success/10 to-success/5 border border-success/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  Total do período
                </p>
                <p className="text-lg font-bold text-success">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-foreground">{counts.aprovados}</p>
              <p className="text-[10px] text-muted-foreground">vendas</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de transações */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-2 pb-24">
          {activeTab === "abandonos" ? (
            filteredAbandoned.length === 0 ? (
              <EmptyState icon={AlertTriangle} message="Nenhum abandono encontrado" />
            ) : (
              filteredAbandoned.map((event) => (
                <AbandonedCard 
                  key={event.id}
                  event={event}
                  formatCurrency={formatCurrency}
                  formatTime={formatTime}
                  formatDate={formatDate}
                  onWhatsApp={openWhatsAppBusiness}
                />
              ))
            )
          ) : (
            filteredTransactions.length === 0 ? (
              <EmptyState icon={FileText} message="Nenhuma transação encontrada" />
            ) : (
              filteredTransactions.map((transaction) => (
                 <TransactionCard
                   key={transaction.id}
                   transaction={transaction}
                   formatCurrency={formatCurrency}
                   formatTime={formatTime}
                   formatDate={formatDate}
                   getTypeIcon={getTypeIcon}
                   getTypeLabel={getTypeLabel}
                   onWhatsApp={(phone) => openWhatsAppBusiness(phone, transaction.customer_name, Number(transaction.amount), "transaction")}
                 />
              ))
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Componente de estado vazio
function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Icon className="h-12 w-12 mb-4 opacity-20" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// Componente de card de transação
interface TransactionCardProps {
  transaction: any;
  formatCurrency: (value: number) => string;
  formatTime: (dateStr: string) => string;
  formatDate: (dateStr: string) => string;
  getTypeIcon: (type: string) => any;
  getTypeLabel: (type: string) => string;
  onWhatsApp: (phone: string | null) => void;
}

function TransactionCard({ 
  transaction, 
  formatCurrency, 
  formatTime, 
  formatDate, 
  getTypeIcon, 
  getTypeLabel,
  onWhatsApp 
}: TransactionCardProps) {
  const Icon = getTypeIcon(transaction.type);
  const isPaid = transaction.status === "pago";
  const displayDate = isPaid && transaction.paid_at ? transaction.paid_at : transaction.created_at;
  
  return (
    <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícone */}
          <div className={cn(
            "h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center",
            isPaid ? "bg-success/10" : "bg-warning/10"
          )}>
            <Icon className={cn("h-5 w-5", isPaid ? "text-success" : "text-warning")} />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">
                {(transaction.customer_name || "Cliente").slice(0, 18)}
                {(transaction.customer_name || "Cliente").length > 18 && "..."}
              </p>
              <p className={cn(
                "text-base font-bold flex-shrink-0 whitespace-nowrap",
                isPaid ? "text-success" : "text-foreground"
              )}>
                {formatCurrency(Number(transaction.amount))}
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                isPaid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}>
                {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {isPaid ? "Pago" : "Pendente"}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                {getTypeLabel(transaction.type)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatTime(displayDate)} • {formatDate(displayDate)}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Botão de recuperação */}
      {!isPaid && transaction.customer_phone && (
        <div className="border-t border-border/30 px-4 py-2.5 bg-secondary/10">
          <button
            onClick={() => onWhatsApp(transaction.customer_phone)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Recuperar via WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}

// Componente de card de abandono
interface AbandonedCardProps {
  event: any;
  formatCurrency: (value: number) => string;
  formatTime: (dateStr: string) => string;
  formatDate: (dateStr: string) => string;
  onWhatsApp: (phone: string | null) => void;
}

function AbandonedCard({ event, formatCurrency, formatTime, formatDate, onWhatsApp }: AbandonedCardProps) {
  return (
    <div className="bg-card rounded-xl border border-destructive/20 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícone */}
          <div className="h-11 w-11 rounded-xl bg-destructive/10 flex-shrink-0 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">
                {(event.customer_name || "Cliente").slice(0, 18)}
                {(event.customer_name || "Cliente").length > 18 && "..."}
              </p>
              <p className="text-base font-bold text-destructive flex-shrink-0 whitespace-nowrap">
                {event.amount ? formatCurrency(event.amount) : "-"}
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                {event.event_type === "cart_abandoned" ? "Carrinho abandonado" : "Falha no pagamento"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatTime(event.created_at)} • {formatDate(event.created_at)}
              </span>
            </div>
            
            {event.product_name && (
              <p className="text-xs text-muted-foreground truncate">
                {event.product_name}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Botão de recuperação */}
      {event.customer_phone && (
        <div className="border-t border-destructive/10 px-4 py-2.5 bg-destructive/5">
          <button
            onClick={() => onWhatsApp(event.customer_phone)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Recuperar via WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}