import { useState, useMemo } from "react";
import { useCustomers, useCustomerEvents, Customer, CustomerEvent, CustomerStats } from "@/hooks/useCustomers";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Users, 
  Phone, 
  Mail, 
  ShoppingCart, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  FileText,
  Zap,
  Banknote,
  QrCode,
  User,
  Copy,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const formatCurrency = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR });
};

const getPaymentMethodIcon = (type?: string) => {
  switch (type) {
    case "boleto": return Banknote;
    case "pix": return QrCode;
    case "cartao": return CreditCard;
    default: return FileText;
  }
};

const getPaymentMethodLabel = (type?: string) => {
  switch (type) {
    case "boleto": return "Boleto";
    case "pix": return "PIX";
    case "cartao": return "Cartão";
    default: return "Transação";
  }
};

function CustomerDetailedModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { events, stats, isLoading } = useCustomerEvents(customer.normalized_phone);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const getEventIcon = (event: CustomerEvent) => {
    if (event.type === "abandoned") {
      return event.event_type === "cart_abandoned" ? ShoppingCart : AlertTriangle;
    }
    return getPaymentMethodIcon(event.transaction_type);
  };

  const getEventColor = (event: CustomerEvent) => {
    if (event.type === "abandoned") {
      return "text-warning";
    }
    switch (event.status) {
      case "pago": return "text-success";
      case "pendente": case "gerado": return "text-info";
      case "cancelado": case "expirado": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getStatusLabel = (event: CustomerEvent) => {
    if (event.type === "abandoned") {
      return event.event_type === "cart_abandoned" ? "Carrinho Abandonado" : "Falha";
    }
    const methodLabel = getPaymentMethodLabel(event.transaction_type);
    const statusMap: Record<string, string> = {
      pago: "Pago",
      pendente: "Pendente",
      gerado: "Gerado",
      cancelado: "Cancelado",
      expirado: "Expirado",
    };
    return `${methodLabel} ${statusMap[event.status || ""] || event.status}`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b border-border/30">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{customer.name || "Sem nome"}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {customer.display_phone && (
                  <button 
                    onClick={() => copyToClipboard(customer.display_phone!, "Telefone")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    {customer.display_phone}
                    <Copy className="h-3 w-3 opacity-50" />
                  </button>
                )}
                {customer.email && (
                  <button 
                    onClick={() => copyToClipboard(customer.email!, "Email")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{customer.email}</span>
                    <Copy className="h-3 w-3 opacity-50" />
                  </button>
                )}
              </div>
              {customer.document && (
                <p className="text-xs text-muted-foreground mt-1">CPF: {customer.document}</p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="resumo" className="flex-1">
          <TabsList className="w-full rounded-none border-b border-border/30 bg-transparent h-auto p-0">
            <TabsTrigger value="resumo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">
              Resumo
            </TabsTrigger>
            <TabsTrigger value="transacoes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">
              Transações ({events.filter(e => e.type === "transaction").length})
            </TabsTrigger>
            <TabsTrigger value="abandonos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">
              Abandonos ({events.filter(e => e.type === "abandoned").length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-[60vh]">
            {/* Resumo Tab */}
            <TabsContent value="resumo" className="p-4 m-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  {/* Payment Methods Breakdown */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Boleto */}
                    <div className="p-3 rounded-lg border border-border/30 bg-secondary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Banknote className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Boleto</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total:</span>
                          <span>{stats.boleto.count}</span>
                        </div>
                        <div className="flex justify-between text-success">
                          <span>Pagos:</span>
                          <span>{stats.boleto.paid}</span>
                        </div>
                        <div className="flex justify-between text-info">
                          <span>Pendentes:</span>
                          <span>{stats.boleto.pending}</span>
                        </div>
                        <div className="pt-1 border-t border-border/30 mt-1">
                          <div className="flex justify-between text-success font-medium">
                            <span>Pago:</span>
                            <span>{formatCurrency(stats.boleto.totalPaid)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PIX */}
                    <div className="p-3 rounded-lg border border-border/30 bg-secondary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <QrCode className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium">PIX</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total:</span>
                          <span>{stats.pix.count}</span>
                        </div>
                        <div className="flex justify-between text-success">
                          <span>Pagos:</span>
                          <span>{stats.pix.paid}</span>
                        </div>
                        <div className="flex justify-between text-info">
                          <span>Pendentes:</span>
                          <span>{stats.pix.pending}</span>
                        </div>
                        <div className="pt-1 border-t border-border/30 mt-1">
                          <div className="flex justify-between text-success font-medium">
                            <span>Pago:</span>
                            <span>{formatCurrency(stats.pix.totalPaid)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cartão */}
                    <div className="p-3 rounded-lg border border-border/30 bg-secondary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">Cartão</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total:</span>
                          <span>{stats.cartao.count}</span>
                        </div>
                        <div className="flex justify-between text-success">
                          <span>Pagos:</span>
                          <span>{stats.cartao.paid}</span>
                        </div>
                        <div className="flex justify-between text-info">
                          <span>Pendentes:</span>
                          <span>{stats.cartao.pending}</span>
                        </div>
                        <div className="pt-1 border-t border-border/30 mt-1">
                          <div className="flex justify-between text-success font-medium">
                            <span>Pago:</span>
                            <span>{formatCurrency(stats.cartao.totalPaid)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <span className="text-sm font-medium">Total Pago</span>
                      </div>
                      <p className="text-2xl font-bold text-success">
                        {formatCurrency(Number(customer.total_paid))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-info/10 border border-info/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-5 w-5 text-info" />
                        <span className="text-sm font-medium">Pendente</span>
                      </div>
                      <p className="text-2xl font-bold text-info">
                        {formatCurrency(Number(customer.total_pending))}
                      </p>
                    </div>
                  </div>

                  {/* Abandonos Summary */}
                  {stats.abandoned.count > 0 && (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingCart className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium text-warning">Abandonos</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>{stats.abandoned.count} evento(s)</span>
                        <span className="font-medium">{formatCurrency(stats.abandoned.totalAmount)}</span>
                      </div>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="p-3 rounded-lg border border-border/30 bg-secondary/5 text-xs text-muted-foreground">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground/60">Primeiro contato:</span>
                        <p>{formatDate(customer.first_seen_at)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/60">Último contato:</span>
                        <p>{formatDate(customer.last_seen_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            {/* Transações Tab */}
            <TabsContent value="transacoes" className="p-4 m-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {events.filter(e => e.type === "transaction").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nenhuma transação encontrada</p>
                    </div>
                  ) : (
                    events.filter(e => e.type === "transaction").map((event) => {
                      const Icon = getEventIcon(event);
                      const color = getEventColor(event);
                      
                      return (
                        <div key={event.id} className="p-3 rounded-lg border border-border/30 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${color}`} />
                              <Badge variant="outline" className={`text-xs ${color}`}>
                                {getStatusLabel(event)}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{formatCurrency(event.amount)}</span>
                            {event.paid_at && (
                              <span className="text-xs text-success flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Pago {formatDate(event.paid_at)}
                              </span>
                            )}
                          </div>
                          
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{event.description}</p>
                          )}
                          
                          {event.external_id && event.transaction_type === "boleto" && (
                            <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono truncate">
                              Cód: {event.external_id}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </TabsContent>

            {/* Abandonos Tab */}
            <TabsContent value="abandonos" className="p-4 m-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {events.filter(e => e.type === "abandoned").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nenhum abandono registrado</p>
                    </div>
                  ) : (
                    events.filter(e => e.type === "abandoned").map((event) => (
                      <div key={event.id} className="p-3 rounded-lg border border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {event.event_type === "cart_abandoned" ? (
                              <ShoppingCart className="h-4 w-4 text-warning" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-warning" />
                            )}
                            <Badge variant="outline" className="text-xs text-warning border-warning/30">
                              {event.event_type === "cart_abandoned" ? "Carrinho Abandonado" : "Falha"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-warning">{formatCurrency(event.amount)}</span>
                        </div>
                        
                        {event.product_name && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{event.product_name}</p>
                        )}
                        
                        {event.error_message && (
                          <p className="text-xs text-destructive/80 mt-1 truncate">{event.error_message}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function Clientes() {
  const { customers, isLoading } = useCustomers();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];
    result.sort((a, b) => Number(b.total_paid) - Number(a.total_paid));
    
    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase().trim();
    return result.filter((c) => {
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
    const totalLeads = customers.reduce((sum, c) => sum + c.total_transactions + c.total_abandoned_events, 0);
    const totalValue = totalPaid + totalPending;
    return { totalCustomers, totalPaid, totalPending, totalAbandoned, totalLeads, totalValue };
  }, [customers]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-lg bg-secondary/20 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Clientes</span>
            </div>
            <p className="text-lg font-bold">{stats.totalCustomers}</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs">Leads</span>
            </div>
            <p className="text-lg font-bold text-primary">{stats.totalLeads}</p>
          </div>
          <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-2 text-foreground mb-1">
              <Banknote className="h-4 w-4" />
              <span className="text-xs">Valor Total</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(stats.totalValue)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 text-success mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Pago</span>
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
      <div className="space-y-2">
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
              className="p-3 rounded-lg border border-border/30 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{customer.name || "Sem nome"}</h3>
                    {customer.total_paid > 0 && (
                      <Badge variant="outline" className="text-success border-success/30 text-[10px] px-1.5 py-0">
                        Cliente
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {customer.display_phone || customer.normalized_phone}
                    </span>
                    <span>{customer.total_transactions} tx</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-success">{formatCurrency(Number(customer.total_paid))}</p>
                  <div className="flex items-center gap-2 justify-end text-[10px] text-muted-foreground">
                    <span className="text-primary">{customer.total_transactions + customer.total_abandoned_events} leads</span>
                    {customer.total_abandoned_events > 0 && (
                      <span className="text-warning">{customer.total_abandoned_events} aband.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <CustomerDetailedModal 
          customer={selectedCustomer} 
          onClose={() => setSelectedCustomer(null)} 
        />
      )}
    </div>
  );
}