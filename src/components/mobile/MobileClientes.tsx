import { useState, useMemo } from "react";
import { Search, Phone, Copy, MessageCircle, ChevronRight, User, AlertTriangle, FileText } from "lucide-react";
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
      <div className="p-4 space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-3 animate-pulse h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {filteredCustomers.length} clientes
        </p>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1.5 pb-20">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum cliente</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="w-full bg-card border border-border/30 rounded-lg p-3 text-left active:bg-secondary/50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-primary/10 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-medium truncate">
                      {customer.name || "Sem nome"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {customer.display_phone || customer.normalized_phone}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-1">
                    <p className="text-sm font-bold text-success">
                      {formatCurrency(customer.total_paid)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {customer.total_transactions} trans
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Modal de detalhes */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
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
  const { events, isLoading } = useCustomerEvents(customer.normalized_phone);
  
  const transactionEvents = events.filter(e => e.type === "transaction" || e.type === "pix_link");
  const abandonedEvents = events.filter(e => e.type === "abandoned");

  const formatDateTime = (dateStr: string) => {
    const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return format(date, "HH:mm dd/MM", { locale: ptBR });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <SheetHeader>
          <SheetTitle className="text-left">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-primary/10 rounded-full flex-shrink-0 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">
                  {customer.name || "Sem nome"}
                </p>
                {customer.display_phone && (
                  <button 
                    onClick={() => onCopy(customer.display_phone)}
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{customer.display_phone}</span>
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => customer.normalized_phone && onWhatsApp(customer.normalized_phone)}
                className="p-2.5 bg-success/10 rounded-full text-success flex-shrink-0"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>
          </SheetTitle>
        </SheetHeader>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-success/10 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-success">{formatCurrency(customer.total_paid)}</p>
            <p className="text-[10px] text-muted-foreground">Pago</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold">{customer.total_transactions}</p>
            <p className="text-[10px] text-muted-foreground">Trans.</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-primary">{customer.pix_payment_count || 0}</p>
            <p className="text-[10px] text-muted-foreground">PIX</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transacoes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-2 mx-4 mt-3 h-9">
          <TabsTrigger value="transacoes" className="text-xs">
            Transações ({transactionEvents.length})
          </TabsTrigger>
          <TabsTrigger value="abandonos" className="text-xs">
            Abandonos ({abandonedEvents.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto mt-2 px-4 pb-6">
          <TabsContent value="transacoes" className="mt-0 space-y-1.5">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
            ) : transactionEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma transação</p>
              </div>
            ) : (
              transactionEvents.map((event) => {
                const isPaid = event.status === "pago" || event.type === "pix_link";
                const typeLabel = event.type === "pix_link" ? "PIX" : (event.transaction_type?.toUpperCase() || "");
                
                return (
                  <div key={event.id} className="bg-card border border-border/30 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                            isPaid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          )}>
                            {isPaid ? "PAGO" : "PEND"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDateTime(event.created_at)}
                        </p>
                      </div>
                      <p className={cn(
                        "text-sm font-bold flex-shrink-0",
                        isPaid ? "text-success" : "text-foreground"
                      )}>
                        {formatCurrency(event.amount || 0)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="abandonos" className="mt-0 space-y-1.5">
            {abandonedEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum abandono</p>
              </div>
            ) : (
              abandonedEvents.map((event) => (
                <div key={event.id} className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        {event.event_type === "cart_abandoned" ? "CARRINHO" : "FALHA"}
                      </span>
                      {event.product_name && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {event.product_name}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDateTime(event.created_at)}
                      </p>
                    </div>
                    {event.amount && (
                      <p className="text-sm font-bold text-destructive flex-shrink-0">
                        {formatCurrency(event.amount)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}