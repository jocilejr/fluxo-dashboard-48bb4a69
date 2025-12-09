import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { BoletoWithRecovery } from "@/hooks/useBoletoRecovery";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addActivityLog } from "@/components/settings/ActivityLogs";
import {
  MessageSquare,
  Phone,
  Copy,
  CheckCircle2,
  SkipForward,
  User,
  Barcode,
  AlertTriangle,
  FileText,
} from "lucide-react";

interface BoletoRecoveryQueueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boletos: BoletoWithRecovery[];
  onMarkContacted: (transactionId: string, ruleId?: string, notes?: string) => void;
}

export function BoletoRecoveryQueue({
  open,
  onOpenChange,
  boletos,
  onMarkContacted,
}: BoletoRecoveryQueueProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { extensionStatus, openChat } = useWhatsAppExtension();

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open]);

  const safeIndex = currentIndex >= boletos.length ? 0 : currentIndex;
  const currentBoleto = boletos.length > 0 ? boletos[safeIndex] : null;
  const progress = boletos.length > 0 ? ((safeIndex) / boletos.length) * 100 : 0;
  const remaining = boletos.length - safeIndex;

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const normalizePhone = (phone: string) => {
    return phone.replace(/\D/g, "").replace(/^0+/, "");
  };

  const handleCopyMessage = useCallback(() => {
    if (currentBoleto?.formattedMessage) {
      navigator.clipboard.writeText(currentBoleto.formattedMessage);
      toast({ title: "Copiado!", description: "Mensagem copiada para a área de transferência" });
      addActivityLog({
        type: "action",
        category: "Recuperação Boleto",
        message: `Mensagem copiada para ${currentBoleto.customer_name || "cliente"}`,
        details: `Telefone: ${currentBoleto.customer_phone}, Valor: R$ ${currentBoleto.amount}`
      });
    }
  }, [currentBoleto, toast]);

  const handleSendWhatsApp = useCallback(async () => {
    if (!currentBoleto?.customer_phone) {
      toast({ title: "Erro", description: "Telefone não disponível", variant: "destructive" });
      addActivityLog({
        type: "error",
        category: "Recuperação Boleto",
        message: "Tentativa de WhatsApp sem telefone",
        details: `Cliente: ${currentBoleto?.customer_name || "não identificado"}`
      });
      return;
    }

    if (extensionStatus !== "connected") {
      toast({ title: "Erro", description: "Extensão WhatsApp não detectada", variant: "destructive" });
      addActivityLog({
        type: "warning",
        category: "Recuperação Boleto",
        message: "Extensão WhatsApp não conectada",
        details: `Cliente: ${currentBoleto.customer_name}, Telefone: ${currentBoleto.customer_phone}`
      });
      return;
    }

    // Primeiro copia a mensagem para a área de transferência
    if (currentBoleto.formattedMessage) {
      await navigator.clipboard.writeText(currentBoleto.formattedMessage);
    }

    // Depois abre o chat sem enviar mensagem
    const phone = normalizePhone(currentBoleto.customer_phone);
    const success = await openChat(phone);

    if (success) {
      toast({ title: "Mensagem copiada!", description: "Cole com Ctrl+V no WhatsApp" });
      addActivityLog({
        type: "success",
        category: "Recuperação Boleto",
        message: `WhatsApp aberto para ${currentBoleto.customer_name || "cliente"}`,
        details: `Telefone: ${currentBoleto.customer_phone}, Valor: R$ ${currentBoleto.amount}, Regra: ${currentBoleto.applicableRule?.name || "N/A"}`
      });
    }
  }, [currentBoleto, extensionStatus, openChat, toast]);

  const handleMarkContacted = useCallback(() => {
    if (!currentBoleto) return;
    
    addActivityLog({
      type: "success",
      category: "Recuperação Boleto",
      message: `Boleto marcado como contactado: ${currentBoleto.customer_name || "cliente"}`,
      details: `Telefone: ${currentBoleto.customer_phone}, Valor: R$ ${currentBoleto.amount}, Regra: ${currentBoleto.applicableRule?.name || "N/A"}`
    });

    onMarkContacted(
      currentBoleto.id,
      currentBoleto.applicableRule?.id,
      undefined
    );
    
    // Don't increment index - the current boleto will be removed from the list
    // after the contact is registered, so the next boleto will shift into the current position
    if (boletos.length <= 1) {
      onOpenChange(false);
      toast({ title: "Parabéns!", description: "Você concluiu a recuperação de hoje! 🎉" });
    }
    // Keep same index - the array will rerender with the contacted boleto removed
  }, [currentBoleto, boletos.length, onMarkContacted, onOpenChange, toast]);

  const handleSkip = useCallback(() => {
    if (currentBoleto) {
      addActivityLog({
        type: "info",
        category: "Recuperação Boleto",
        message: `Boleto pulado: ${currentBoleto.customer_name || "cliente"}`,
        details: `Telefone: ${currentBoleto.customer_phone}, Valor: R$ ${currentBoleto.amount}`
      });
    }
    if (safeIndex < boletos.length - 1) {
      setCurrentIndex(safeIndex + 1);
    } else {
      onOpenChange(false);
    }
  }, [safeIndex, boletos.length, onOpenChange, currentBoleto]);

  const handleClose = () => {
    setCurrentIndex(0);
    onOpenChange(false);
  };

  if (!currentBoleto) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md border-0 bg-gradient-to-b from-card to-background p-0 overflow-hidden">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Tudo em dia!</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Nenhum boleto para recuperar no momento. Configure novas regras na régua de cobrança.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-2xl border-0 bg-gradient-to-b from-card to-background p-0 overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="p-3 sm:p-4 md:p-6 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight">Modo Recuperação</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Fila de contatos pendentes</p>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5 shrink-0">
              {safeIndex + 1}/{boletos.length}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] sm:text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1" />
            <p className="text-[10px] text-muted-foreground">
              {remaining} {remaining === 1 ? 'restante' : 'restantes'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 overflow-y-auto max-h-[50vh]">
          {/* Customer Card */}
          <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
            <div className="p-2.5 sm:p-3 border-b border-border/30 flex items-center gap-2 sm:gap-3">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10 shrink-0">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs sm:text-sm truncate">
                  {currentBoleto.customer_name || "Cliente não identificado"}
                </h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{currentBoleto.customer_phone || "Sem telefone"}</span>
                </p>
              </div>
              {currentBoleto.isOverdue && (
                <Badge variant="destructive" className="gap-1 shrink-0 text-[9px] px-1.5 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                </Badge>
              )}
            </div>

            <div className="p-2.5 sm:p-3 grid grid-cols-4 gap-2">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">Valor</p>
                <p className="font-semibold text-[11px] sm:text-xs text-primary truncate">{formatCurrency(currentBoleto.amount)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">Gerado</p>
                <p className="font-medium text-[10px] sm:text-xs truncate">
                  {format(new Date(currentBoleto.created_at), "dd/MM/yy", { locale: ptBR })}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">Vence</p>
                <p className="font-medium text-[10px] sm:text-xs truncate">
                  {format(currentBoleto.dueDate, "dd/MM/yy", { locale: ptBR })}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">Regra</p>
                <p className="font-medium text-[10px] sm:text-xs truncate">
                  {currentBoleto.applicableRule?.name || "—"}
                </p>
              </div>
            </div>

            {currentBoleto.external_id && (
              <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3">
                <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded bg-background/50 border border-border/30 overflow-hidden">
                  <Barcode className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-mono text-[9px] sm:text-[10px] truncate text-muted-foreground flex-1">
                    {currentBoleto.external_id}
                  </span>
                  {(currentBoleto.metadata as any)?.boleto_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 sm:h-6 text-[9px] sm:text-[10px] gap-1 shrink-0 px-1.5 sm:px-2"
                      onClick={() => window.open((currentBoleto.metadata as any).boleto_url, "_blank")}
                    >
                      <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      Boleto
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Message Preview */}
          {currentBoleto.formattedMessage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  Mensagem
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCopyMessage} 
                  className="h-6 text-[10px] sm:text-xs gap-1 hover:bg-muted px-2"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </Button>
              </div>
              <div className="p-2.5 sm:p-3 rounded-lg bg-muted/30 border border-border/30 text-[11px] sm:text-xs leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                {currentBoleto.formattedMessage}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 md:p-6 pt-3 border-t border-border/50 bg-muted/10">
          <div className="flex gap-2">
            <Button 
              onClick={handleSendWhatsApp} 
              className="flex-1 gap-1.5 h-8 sm:h-9 font-medium text-[11px] sm:text-xs" 
              disabled={!currentBoleto.customer_phone}
            >
              <Phone className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
            <Button 
              onClick={handleMarkContacted} 
              variant="secondary" 
              className="flex-1 gap-1.5 h-8 sm:h-9 font-medium text-[11px] sm:text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Contactado
            </Button>
            <Button 
              onClick={handleSkip} 
              variant="ghost" 
              className="gap-1 h-8 sm:h-9 text-[11px] sm:text-xs px-2 sm:px-3"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
