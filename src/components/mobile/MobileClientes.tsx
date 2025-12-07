import { useState, useMemo } from "react";
import { Search, Phone, Mail, Copy, MessageCircle, ChevronRight, User, DollarSign, AlertTriangle, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCustomers, useCustomerEvents } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card/50 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-3 bg-muted rounded w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header com busca */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/30 border-border/30"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Lista de clientes */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="w-full bg-card/50 border border-border/30 rounded-xl p-4 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {customer.name || "Cliente sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {customer.display_phone || customer.normalized_phone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-success">
                      {formatCurrency(customer.total_paid)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {customer.total_transactions} transações
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Sheet de detalhes do cliente */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
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

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="pb-4 border-b border-border/30">
        <SheetTitle className="text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{customer.name || "Cliente sem nome"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {customer.display_phone && (
                  <button 
                    onClick={() => onCopy(customer.display_phone)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    {customer.display_phone}
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => customer.normalized_phone && onWhatsApp(customer.normalized_phone)}
              className="p-2 bg-success/20 rounded-full text-success"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          </div>
        </SheetTitle>
      </SheetHeader>

      <Tabs defaultValue="resumo" className="flex-1 flex flex-col mt-4">
        <TabsList className="grid grid-cols-3 bg-secondary/30">
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
          <TabsTrigger value="transacoes" className="text-xs">
            Transações ({events.filter(e => e.type === "transaction" || e.type === "pix_link").length})
          </TabsTrigger>
          <TabsTrigger value="abandonos" className="text-xs">
            Abandonos ({events.filter(e => e.type === "abandoned").length})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 mt-4">
          <TabsContent value="resumo" className="mt-0">
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Selecione uma aba para ver detalhes</p>
            </div>
          </TabsContent>

          <TabsContent value="transacoes" className="mt-0 space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : events.filter(e => e.type === "transaction" || e.type === "pix_link").length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma transação encontrada</p>
              </div>
            ) : (
              events.filter(e => e.type === "transaction" || e.type === "pix_link").map((event) => {
                const label = event.type === "pix_link" 
                  ? "PIX Pago" 
                  : `${event.transaction_type?.toUpperCase() || ""} ${event.status === "pago" ? "Pago" : "Pendente"}`;
                return (
                  <div key={event.id} className="bg-card/50 border border-border/30 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full",
                          event.status === "pago" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                        )}>
                          {label}
                        </span>
                        <p className="font-semibold mt-1">{formatCurrency(event.amount || 0)}</p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{event.description}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(event.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="abandonos" className="mt-0 space-y-2">
            {events.filter(e => e.type === "abandoned").length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum abandono encontrado</p>
              </div>
            ) : (
              events.filter(e => e.type === "abandoned").map((event) => {
                const label = event.event_type === "cart_abandoned" ? "Carrinho Abandonado" : "Falha";
                return (
                  <div key={event.id} className="bg-destructive/5 border border-destructive/30 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                          {label}
                        </span>
                        {event.amount && (
                          <p className="font-semibold mt-1">{formatCurrency(event.amount)}</p>
                        )}
                        {event.product_name && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{event.product_name}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(event.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
