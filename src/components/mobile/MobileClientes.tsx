import { useState, useMemo } from "react";
import { Search, Phone, Copy, MessageCircle, User, AlertTriangle, FileText, Pencil, Trash2, Check, X, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomers, useCustomerEvents } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
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
      <div className="p-3 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-3 animate-pulse h-14" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header compacto */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
          {filteredCustomers.length} clientes • ordenado por valor
        </p>
      </div>

      {/* Lista compacta */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1 pb-20">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum cliente</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="w-full bg-card border border-border/20 rounded-lg px-3 py-2.5 text-left active:bg-secondary/50"
              >
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">
                      {customer.name || "Sem nome"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {customer.display_phone || customer.normalized_phone}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-bold text-success">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(customer.total_paid)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Modal de detalhes */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0">
          {selectedCustomer && (
            <CustomerDetails 
              customer={selectedCustomer} 
              onCopy={copyToClipboard}
              onWhatsApp={openWhatsApp}
              onClose={() => setSelectedCustomer(null)}
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
  onClose: () => void;
}

function CustomerDetails({ customer, onCopy, onWhatsApp, onClose }: CustomerDetailsProps) {
  const { events, stats, isLoading, refetch } = useCustomerEvents(customer.normalized_phone, customer.merged_phones);
  const { updateCustomer, deleteTransaction, deleteAbandonedEvent } = useCustomers();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(customer.name || "");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "transaction" | "abandoned"; id: string } | null>(null);
  
  const transactionEvents = events.filter(e => e.type === "transaction" || e.type === "pix_link");
  const abandonedEvents = events.filter(e => e.type === "abandoned");
  const deliveryAccessEvents = events.filter(e => e.type === "delivery_access");

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return format(date, "HH:mm dd/MM", { locale: ptBR });
  };

  const handleSaveEdit = async () => {
    try {
      await updateCustomer(customer.id, { name: editName.trim() || null });
      setIsEditing(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      if (deleteConfirm.type === "transaction") {
        await deleteTransaction(deleteConfirm.id);
      } else {
        await deleteAbandonedEvent(deleteConfirm.id);
      }
      refetch();
      setDeleteConfirm(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <SheetHeader>
          <SheetTitle className="text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex-shrink-0 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Nome do cliente"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-base truncate">
                      {customer.name || "Sem nome"}
                    </p>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditName(customer.name || ""); setIsEditing(true); }}>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                {customer.display_phone && (
                  <button 
                    onClick={() => onCopy(customer.display_phone)}
                    className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"
                  >
                    <Phone className="h-3 w-3" />
                    <span>{customer.display_phone}</span>
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => customer.normalized_phone && onWhatsApp(customer.normalized_phone)}
                className="p-3 bg-success/10 rounded-full text-success flex-shrink-0"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>
          </SheetTitle>
        </SheetHeader>
        
        {/* Stats compactos */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <div className="bg-success/10 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-success">{formatCurrency(customer.total_paid)}</p>
            <p className="text-[9px] text-muted-foreground">Pago</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <p className="text-xs font-bold">{customer.total_transactions}</p>
            <p className="text-[9px] text-muted-foreground">Trans</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-primary">{customer.pix_payment_count || 0}</p>
            <p className="text-[9px] text-muted-foreground">PIX</p>
          </div>
          <div className="bg-info/10 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-info">{stats?.deliveryAccesses || 0}</p>
            <p className="text-[9px] text-muted-foreground">Acessos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transacoes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-3 mx-3 mt-2 h-8">
          <TabsTrigger value="transacoes" className="text-[10px] py-1">
            Trans ({transactionEvents.length})
          </TabsTrigger>
          <TabsTrigger value="acessos" className="text-[10px] py-1">
            Links ({deliveryAccessEvents.length})
          </TabsTrigger>
          <TabsTrigger value="abandonos" className="text-[10px] py-1">
            Aband ({abandonedEvents.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto mt-2 px-3 pb-6">
          {/* Transações */}
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
                  <div key={event.id} className="bg-card border border-border/30 rounded-lg p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded",
                            isPaid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          )}>
                            {isPaid ? "PAGO" : "PEND"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                          <span className="text-[9px] text-muted-foreground">•</span>
                          <span className="text-[9px] text-muted-foreground">{formatDateTime(event.created_at)}</span>
                        </div>
                        {event.description && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{event.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <p className={cn("text-sm font-bold", isPaid ? "text-success" : "text-foreground")}>
                          {formatCurrency(event.amount)}
                        </p>
                        {event.type === "transaction" && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-destructive/50 hover:text-destructive"
                            onClick={() => setDeleteConfirm({ type: "transaction", id: event.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* Acessos de entrega */}
          <TabsContent value="acessos" className="mt-0 space-y-1.5">
            {deliveryAccessEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum acesso de entrega</p>
              </div>
            ) : (
              deliveryAccessEvents.map((event) => (
                <div key={event.id} className="bg-info/5 border border-info/20 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-info/10 text-info">
                        ACESSOU LINK
                      </span>
                      <p className="text-xs text-foreground truncate mt-1">
                        {event.product_name || "Produto"}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDateTime(event.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Abandonos */}
          <TabsContent value="abandonos" className="mt-0 space-y-1.5">
            {abandonedEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum abandono</p>
              </div>
            ) : (
              abandonedEvents.map((event) => (
                <div key={event.id} className="bg-destructive/5 border border-destructive/20 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        {event.event_type === "cart_abandoned" ? "CARRINHO" : "FALHA"}
                      </span>
                      {event.product_name && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {event.product_name}
                        </p>
                      )}
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {formatDateTime(event.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {event.amount && (
                        <p className="text-sm font-bold text-destructive">
                          {formatCurrency(event.amount)}
                        </p>
                      )}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-destructive/50 hover:text-destructive"
                        onClick={() => setDeleteConfirm({ type: "abandoned", id: event.id })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Dialog de confirmação */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este {deleteConfirm?.type === "transaction" ? "transação" : "evento"}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}