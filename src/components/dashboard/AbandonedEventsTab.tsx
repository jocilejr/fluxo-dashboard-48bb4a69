import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Search, ShoppingCart, AlertTriangle, Phone, MessageSquare, Users, Clock, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAbandonedEvents, AbandonedEvent } from "@/hooks/useAbandonedEvents";
import { useQuery } from "@tanstack/react-query";
import { getGreeting } from "@/lib/greeting";
import { AbandonedRecoverySettings } from "./AbandonedRecoverySettings";
import { addActivityLog } from "@/components/settings/ActivityLogs";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AbandonedEventsTabProps {
  isAdmin?: boolean;
}

const eventTypeStyles = {
  cart_abandoned: "bg-warning/20 text-warning border-warning/30",
  boleto_failed: "bg-destructive/20 text-destructive border-destructive/30",
};

const eventTypeLabels = {
  cart_abandoned: "Carrinho",
  boleto_failed: "Falha Boleto",
};

const eventTypeIcons = {
  cart_abandoned: ShoppingCart,
  boleto_failed: AlertTriangle,
};

const VIEWED_ABANDONED_KEY = "viewed_abandoned_events";

export function AbandonedEventsTab({ isAdmin = false }: AbandonedEventsTabProps) {
  const navigate = useNavigate();
  const { events, isLoading, deleteEvent } = useAbandonedEvents();
  const { openChat, extensionStatus } = useWhatsAppExtension();
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(15);
  const [viewedIds, setViewedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(VIEWED_ABANDONED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const { data: recoverySettings } = useQuery({
    queryKey: ["abandoned-recovery-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abandoned_recovery_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
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

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const query = searchQuery.toLowerCase().trim();
    return events.filter((e) => {
      const name = e.customer_name?.toLowerCase() || "";
      const phone = e.customer_phone?.toLowerCase() || "";
      const email = e.customer_email?.toLowerCase() || "";
      const document = e.customer_document?.toLowerCase() || "";
      const errorMsg = e.error_message?.toLowerCase() || "";
      return (
        name.includes(query) ||
        phone.includes(query) ||
        email.includes(query) ||
        document.includes(query) ||
        errorMsg.includes(query)
      );
    });
  }, [events, searchQuery]);

  const unviewedCount = useMemo(() => {
    return events.filter(e => !viewedIds.includes(e.id)).length;
  }, [events, viewedIds]);

  const markAllAsViewed = useCallback(() => {
    const allIds = events.map(e => e.id);
    setViewedIds(allIds);
    localStorage.setItem(VIEWED_ABANDONED_KEY, JSON.stringify(allIds));
  }, [events]);

  useEffect(() => {
    if (events.length > 0) {
      markAllAsViewed();
    }
  }, [events, markAllAsViewed]);

  const handleDelete = async (id: string) => {
    try {
      const event = events.find(e => e.id === id);
      await deleteEvent(id);
      toast.success("Evento removido");
      addActivityLog({
        type: "action",
        category: "Abandono",
        message: `Evento de abandono removido: ${event?.customer_name || 'N/A'}`,
        details: `Tipo: ${event?.event_type || 'N/A'}, Valor: R$ ${event?.amount || 0}`
      });
    } catch (error: any) {
      toast.error("Erro ao remover evento");
      console.error(error);
    }
  };

  const prepareRecoveryMessage = (event: AbandonedEvent) => {
    const firstName = event.customer_name?.split(' ')[0] || 'Cliente';
    const fullName = event.customer_name || 'Cliente';
    const amount = event.amount ? formatCurrency(event.amount) : '';
    const greeting = getGreeting();

    const template = recoverySettings?.message || 'Olá {primeiro_nome}! Vi que você demonstrou interesse em nossos produtos. Posso ajudar você a finalizar sua compra?';
    
    return template
      .replace(/{saudação}/g, greeting)
      .replace(/{nome}/g, fullName)
      .replace(/{primeiro_nome}/g, firstName)
      .replace(/{valor}/g, amount);
  };

  const openWhatsApp = async (event: AbandonedEvent) => {
    if (!event.customer_phone) {
      toast.error("Cliente sem telefone cadastrado");
      addActivityLog({
        type: "error",
        category: "Abandono",
        message: "Tentativa de WhatsApp sem telefone",
        details: `Cliente: ${event.customer_name || 'N/A'}, Tipo: ${event.event_type}`
      });
      return;
    }

    if (extensionStatus !== "connected") {
      toast.error("Extensão WhatsApp não detectada");
      addActivityLog({
        type: "warning",
        category: "Abandono",
        message: "Extensão WhatsApp não conectada",
        details: `Cliente: ${event.customer_name}, Telefone: ${event.customer_phone}`
      });
      return;
    }

    // Primeiro copia a mensagem
    const message = prepareRecoveryMessage(event);
    await navigator.clipboard.writeText(message);

    // Depois abre o chat
    const phone = event.customer_phone.replace(/\D/g, '');
    const success = await openChat(phone);

    if (success) {
      toast.success("Mensagem copiada! Cole com Ctrl+V");
      addActivityLog({
        type: "success",
        category: "Abandono",
        message: `WhatsApp aberto para recuperação: ${event.customer_name || 'Cliente'}`,
        details: `Tipo: ${event.event_type}, Telefone: ${event.customer_phone}, Valor: R$ ${event.amount || 0}`
      });
    } else {
      toast.error("Erro ao abrir conversa");
    }
  };

  const copyMessage = (event: AbandonedEvent) => {
    const message = prepareRecoveryMessage(event);
    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
    addActivityLog({
      type: "action",
      category: "Abandono",
      message: `Mensagem copiada para ${event.customer_name || 'Cliente'}`,
      details: `Tipo: ${event.event_type}, Valor: R$ ${event.amount || 0}`
    });
  };

  const navigateToGerarBoleto = (event: AbandonedEvent) => {
    const params = new URLSearchParams();
    if (event.customer_name) params.set("nome", event.customer_name);
    if (event.customer_phone) params.set("telefone", event.customer_phone);
    if (event.amount) params.set("valor", event.amount.toString());
    if (event.customer_document) params.set("cpf", event.customer_document);
    
    navigate(`/gerar-boleto?${params.toString()}`);
    
    addActivityLog({
      type: "action",
      category: "Abandono",
      message: `Iniciou geração de boleto para ${event.customer_name || 'Cliente'}`,
      details: `Telefone: ${event.customer_phone}, Valor: R$ ${event.amount || 0}`
    });
  };

  // Stats
  const stats = useMemo(() => {
    const totalAmount = filteredEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
    const cartAbandoned = filteredEvents.filter(e => e.event_type === 'cart_abandoned').length;
    const boletoFailed = filteredEvents.filter(e => e.event_type === 'boleto_failed').length;
    return { totalAmount, cartAbandoned, boletoFailed, total: filteredEvents.length };
  }, [filteredEvents]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar - Admin only */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-secondary/20 rounded-lg border border-border/30">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10">
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Carrinhos</p>
              <p className="text-xs sm:text-sm font-semibold">{stats.cartAbandoned}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Falhas</p>
              <p className="text-xs sm:text-sm font-semibold">{stats.boletoFailed}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-info/10">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-info" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
              <p className="text-xs sm:text-sm font-semibold">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Valor Total</p>
              <p className="text-xs sm:text-sm font-semibold">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email, motivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        {isAdmin && <div className="hidden sm:block"><AbandonedRecoverySettings /></div>}
      </div>

      {/* Mobile View */}
      <div className="block sm:hidden space-y-3">
        {filteredEvents.slice(0, 10).map((event) => {
          const Icon = eventTypeIcons[event.event_type as keyof typeof eventTypeIcons] || ShoppingCart;
          return (
            <div key={event.id} className="border border-border/30 rounded-lg p-3 bg-secondary/10">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className={cn("font-medium text-xs", eventTypeStyles[event.event_type as keyof typeof eventTypeStyles])}>
                  <Icon className="h-3 w-3 mr-1" />
                  {eventTypeLabels[event.event_type as keyof typeof eventTypeLabels] || event.event_type}
                </Badge>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate max-w-[60%]">
                  {event.customer_name || '-'}
                </span>
                <span className="text-sm font-bold">{formatCurrency(event.amount)}</span>
              </div>
              {event.error_message && (
                <p className="text-xs text-destructive/80 mb-1 truncate">{event.error_message}</p>
              )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatRelativeTime(event.created_at)}</span>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary"
                            onClick={() => navigateToGerarBoleto(event)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Gerar boleto</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {event.customer_phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-success hover:text-success"
                        onClick={() => openWhatsApp(event)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] rounded-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover evento?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(event.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* Desktop View */}
      <div className="hidden sm:block overflow-hidden rounded-lg border border-border/30">
        <table className="w-full">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Motivo da Recusa</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  {searchQuery ? (
                    <div>
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Nenhum evento encontrado</p>
                      <p className="text-sm">Tente buscar com outros termos</p>
                    </div>
                  ) : (
                    <div>
                      <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Nenhum evento ainda</p>
                      <p className="text-sm">Os eventos de abandono aparecerão aqui</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredEvents.slice(0, visibleCount).map((event, index) => {
                const Icon = eventTypeIcons[event.event_type as keyof typeof eventTypeIcons] || ShoppingCart;
                return (
                  <tr 
                    key={event.id} 
                    className="group hover:bg-secondary/40 transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className={cn("font-medium text-xs", eventTypeStyles[event.event_type as keyof typeof eventTypeStyles])}>
                        <Icon className="h-3 w-3 mr-1" />
                        {eventTypeLabels[event.event_type as keyof typeof eventTypeLabels] || event.event_type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[200px]">{event.customer_name || '-'}</span>
                        {event.customer_phone && (
                          <span className="text-xs text-muted-foreground">{event.customer_phone}</span>
                        )}
                        {event.customer_document && (
                          <span className="text-xs text-info font-medium">CPF: {event.customer_document}</span>
                        )}
                        {event.customer_email && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{event.customer_email}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <span className="text-sm text-destructive/80 truncate max-w-[200px] block">{event.error_message || '-'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col cursor-help">
                              <span className="text-sm font-medium">{formatRelativeTime(event.created_at)}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{formatDate(event.created_at)}</p>
                            {event.utm_source && <p className="text-xs text-muted-foreground">Origem: {event.utm_source}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-sm font-bold">{formatCurrency(event.amount)}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => navigateToGerarBoleto(event)}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Gerar boleto com esses dados</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {event.customer_phone && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success hover:bg-success/10">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="end">
                              <div className="space-y-3">
                                <h4 className="font-medium text-sm">Mensagem de Recuperação</h4>
                                <div className="p-3 bg-secondary/30 rounded-lg text-sm">
                                  {prepareRecoveryMessage(event)}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="flex-1" onClick={() => copyMessage(event)}>
                                    Copiar
                                  </Button>
                                  <Button size="sm" className="flex-1 bg-success hover:bg-success/90" onClick={() => openWhatsApp(event)}>
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    WhatsApp
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        {isAdmin && (
                          <AlertDialog>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Remover evento</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover evento?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(event.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {filteredEvents.length > visibleCount && (
        <div className="text-center pt-4">
          <Button variant="outline" size="sm" onClick={() => setVisibleCount(prev => prev + 15)}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}

export function getAbandonedUnviewedCount(): number {
  try {
    const viewed = localStorage.getItem(VIEWED_ABANDONED_KEY);
    const viewedIds = viewed ? JSON.parse(viewed) : [];
    // This is a placeholder - the actual count would need to come from the parent
    return 0;
  } catch {
    return 0;
  }
}
