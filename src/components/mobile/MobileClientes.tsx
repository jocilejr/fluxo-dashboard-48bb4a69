import { useState, useMemo } from "react";
import { Search, Phone, Copy, MessageCircle, ChevronRight, User, AlertTriangle, FileText, DollarSign, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCustomers, useCustomerEvents } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MobileClientes() {
  const { customers, isLoading } = useCustomers();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<typeof customers[0] | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.normalized_phone?.includes(query) ||
      c.display_phone?.includes(query)
    );
  }, [customers, searchQuery]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const formatted = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://api.whatsapp.com/send?phone=${formatted}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-secondary/30 border-border/30 text-sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Ordenado por valor
          </p>
        </div>
      </div>

      {/* Lista de clientes */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2 pb-24">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum cliente encontrado</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="w-full bg-card border border-border/40 rounded-xl p-4 text-left transition-all active:scale-[0.98] hover:bg-card/80"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 bg-primary/10 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium text-sm text-foreground truncate">
                      {customer.name || "Cliente sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {customer.display_phone || customer.normalized_phone}
                    </p>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex flex-col items-end flex-shrink-0 gap-1">
                    <p className="text-sm font-bold text-success">
                      {formatCurrency(customer.total_paid)}
                    </p>
                    <p className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                      {customer.total_transactions} transações
                    </p>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Sheet de detalhes */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0">
          {selectedCustomer && (
            <CustomerDetails 
              customer={selectedCustomer} 
              onCopy={copyToClipboard}
              onWhatsApp={openWhatsApp}
              formatCurrency={formatCurrency}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface CustomerDetailsProps {
  customer: any;
  onCopy: (text: string) => void;
  onWhatsApp: (phone: string) => void;
  formatCurrency: (value: number) => string;
}

function CustomerDetails({ customer, onCopy, onWhatsApp, formatCurrency }: CustomerDetailsProps) {
  const { events, stats, isLoading } = useCustomerEvents(customer.normalized_phone);
  
  const transactionEvents = events.filter(e => e.type === "transaction" || e.type === "pix_link");
  const abandonedEvents = events.filter(e => e.type === "abandoned");

  const formatDateTime = (dateStr: string) => {
    const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return format(date, "HH:mm • dd/MM/yy", { locale: ptBR });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header do cliente */}
      <div className="p-4 border-b border-border/30 bg-card/50">
        <SheetHeader>
          <SheetTitle className="text-left">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex-shrink-0 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-semibold text-base truncate">{customer.name || "Cliente sem nome"}</p>
                {customer.display_phone && (
                  <button 
                    onClick={() => onCopy(customer.display_phone)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{customer.display_phone}</span>
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => customer.normalized_phone && onWhatsApp(customer.normalized_phone)}
                className="p-3 bg-success/10 rounded-xl text-success flex-shrink-0"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>
          </SheetTitle>
        </SheetHeader>
        
        {/* Stats resumo */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-success">{formatCurrency(customer.total_paid)}</p>
            <p className="text-[10px] text-muted-foreground">Total Pago</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">{customer.total_transactions}</p>
            <p className="text-[10px] text-muted-foreground">Transações</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-primary">{customer.pix_payment_count || 0}</p>
            <p className="text-[10px] text-muted-foreground">PIX Pagos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transacoes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-2 mx-4 mt-3 bg-secondary/30 p-1 h-auto">
          <TabsTrigger value="transacoes" className="text-xs py-2.5 data-[state=active]:bg-background">
            Transações ({transactionEvents.length})
          </TabsTrigger>
          <TabsTrigger value="abandonos" className="text-xs py-2.5 data-[state=active]:bg-background">
            Abandonos ({abandonedEvents.length})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 mt-3">
          <TabsContent value="transacoes" className="mt-0 px-4 pb-8">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />
                ))}
              </div>
            ) : transactionEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma transação</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactionEvents.map((event) => {
                  const isPix = event.type === "pix_link" || event.transaction_type === "pix";
                  const isPaid = event.status === "pago" || event.type === "pix_link";
                  const typeLabel = event.type === "pix_link" ? "PIX" : (event.transaction_type?.toUpperCase() || "");
                  
                  return (
                    <div key={event.id} className="bg-card border border-border/40 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                              isPaid 
                                ? "bg-success/10 text-success" 
                                : "bg-warning/10 text-warning"
                            )}>
                              {isPaid ? "PAGO" : "PENDENTE"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {typeLabel}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {event.description}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {formatDateTime(event.created_at)}
                          </p>
                        </div>
                        <p className={cn(
                          "text-base font-bold flex-shrink-0",
                          isPaid ? "text-success" : "text-foreground"
                        )}>
                          {formatCurrency(event.amount || 0)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="abandonos" className="mt-0 px-4 pb-8">
            {abandonedEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum abandono</p>
              </div>
            ) : (
              <div className="space-y-2">
                {abandonedEvents.map((event) => (
                  <div key={event.id} className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          {event.event_type === "cart_abandoned" ? "CARRINHO" : "FALHA"}
                        </span>
                        {event.product_name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {event.product_name}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {formatDateTime(event.created_at)}
                        </p>
                      </div>
                      {event.amount && (
                        <p className="text-base font-bold text-destructive flex-shrink-0">
                          {formatCurrency(event.amount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}