import { useState, useMemo } from "react";
import { useCustomers, useCustomerEvents, Customer, CustomerEvent } from "@/hooks/useCustomers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Users, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  ShoppingCart, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  FileText,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR });
};

const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem atrás`;
  return format(date, "dd/MM/yy", { locale: ptBR });
};

function CustomerTimeline({ normalizedPhone }: { normalizedPhone: string }) {
  const { events, isLoading } = useCustomerEvents(normalizedPhone);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Nenhum evento encontrado</p>
      </div>
    );
  }

  const getEventIcon = (event: CustomerEvent) => {
    if (event.type === "abandoned") {
      return event.event_type === "cart_abandoned" ? ShoppingCart : AlertTriangle;
    }
    switch (event.status) {
      case "pago": return CheckCircle2;
      case "pendente": return Clock;
      case "gerado": return FileText;
      case "cancelado": case "expirado": return XCircle;
      default: return CreditCard;
    }
  };

  const getEventColor = (event: CustomerEvent) => {
    if (event.type === "abandoned") {
      return event.event_type === "cart_abandoned" ? "text-warning" : "text-destructive";
    }
    switch (event.status) {
      case "pago": return "text-success";
      case "pendente": case "gerado": return "text-info";
      case "cancelado": case "expirado": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getEventLabel = (event: CustomerEvent) => {
    if (event.type === "abandoned") {
      return event.event_type === "cart_abandoned" ? "Carrinho Abandonado" : "Falha Boleto";
    }
    const statusMap: Record<string, string> = {
      pago: "Pago",
      pendente: "Pendente",
      gerado: "Gerado",
      cancelado: "Cancelado",
      expirado: "Expirado",
    };
    return statusMap[event.status || ""] || event.status;
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {events.map((event) => {
          const Icon = getEventIcon(event);
          const color = getEventColor(event);

          return (
            <div key={`${event.type}-${event.id}`} className="relative pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-2 top-2 h-5 w-5 rounded-full bg-background border-2 border-border flex items-center justify-center`}>
                <Icon className={`h-3 w-3 ${color}`} />
              </div>

              <div className="p-3 rounded-lg border border-border/30 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className={`text-xs ${color}`}>
                    {getEventLabel(event)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{formatCurrency(event.amount)}</span>
                  {event.paid_at && (
                    <span className="text-xs text-success">
                      Pago em {formatDate(event.paid_at)}
                    </span>
                  )}
                </div>

                {(event.description || event.product_name) && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {event.description || event.product_name}
                  </p>
                )}

                {event.error_message && (
                  <p className="text-xs text-destructive/80 mt-1 truncate">
                    {event.error_message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Clientes() {
  const { customers, isLoading } = useCustomers();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const name = c.name?.toLowerCase() || "";
      const phone = c.display_phone?.toLowerCase() || "";
      const normalizedPhone = c.normalized_phone?.toLowerCase() || "";
      const email = c.email?.toLowerCase() || "";
      const document = c.document?.toLowerCase() || "";
      return (
        name.includes(query) ||
        phone.includes(query) ||
        normalizedPhone.includes(query) ||
        email.includes(query) ||
        document.includes(query)
      );
    });
  }, [customers, searchQuery]);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalPaid = customers.reduce((sum, c) => sum + Number(c.total_paid), 0);
    const totalPending = customers.reduce((sum, c) => sum + Number(c.total_pending), 0);
    const totalAbandoned = customers.reduce((sum, c) => sum + c.total_abandoned_events, 0);
    return { totalCustomers, totalPaid, totalPending, totalAbandoned };
  }, [customers]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">Visualização unificada de todos os leads</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-secondary/20 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Total Clientes</span>
            </div>
            <p className="text-lg font-bold">{stats.totalCustomers}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 text-success mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Total Pago</span>
            </div>
            <p className="text-lg font-bold text-success">{formatCurrency(stats.totalPaid)}</p>
          </div>
          <div className="p-3 rounded-lg bg-info/10 border border-info/20">
            <div className="flex items-center gap-2 text-info mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Pendente</span>
            </div>
            <p className="text-lg font-bold text-info">{formatCurrency(stats.totalPending)}</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2 text-warning mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs">Abandonos</span>
            </div>
            <p className="text-lg font-bold text-warning">{stats.totalAbandoned}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, email, CPF..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm">Os clientes aparecerão aqui quando receberem transações</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="p-4 rounded-lg border border-border/30 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{customer.name || "Sem nome"}</h3>
                    {customer.total_paid > 0 && (
                      <Badge variant="outline" className="text-success border-success/30 text-xs">
                        Cliente
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {customer.display_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.display_phone}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatRelativeDate(customer.last_seen_at)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-muted-foreground">{customer.total_transactions} transações</span>
                    {customer.total_abandoned_events > 0 && (
                      <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                        {customer.total_abandoned_events} abandono{customer.total_abandoned_events > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg font-bold text-success mt-1">{formatCurrency(Number(customer.total_paid))}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Details Modal */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border/30">
            <DialogTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{selectedCustomer?.name || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {selectedCustomer?.display_phone || selectedCustomer?.normalized_phone}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 p-4 border-b border-border/30">
                <div className="text-center">
                  <p className="text-lg font-bold text-success">{formatCurrency(Number(selectedCustomer.total_paid))}</p>
                  <p className="text-xs text-muted-foreground">Pago</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-info">{formatCurrency(Number(selectedCustomer.total_pending))}</p>
                  <p className="text-xs text-muted-foreground">Pendente</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{selectedCustomer.total_transactions}</p>
                  <p className="text-xs text-muted-foreground">Transações</p>
                </div>
              </div>

              {/* Timeline */}
              <ScrollArea className="flex-1 p-4 max-h-[50vh]">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Histórico de Interações
                </h4>
                <CustomerTimeline normalizedPhone={selectedCustomer.normalized_phone} />
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
