import { useState, useEffect } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { getGreeting } from "@/lib/greeting";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface PixCardQuickRecoveryProps {
  transaction: Transaction;
}

export function PixCardQuickRecovery({ transaction }: PixCardQuickRecoveryProps) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const { openChat, extensionStatus } = useWhatsAppExtension();

  // Fetch click count
  useEffect(() => {
    const fetchClickCount = async () => {
      const { count } = await supabase
        .from("pix_card_recovery_clicks")
        .select("*", { count: "exact", head: true })
        .eq("transaction_id", transaction.id);
      
      setClickCount(count || 0);
    };

    fetchClickCount();
  }, [transaction.id]);

  useEffect(() => {
    const fetchMessage = async () => {
      const { data } = await supabase
        .from("pix_card_recovery_settings")
        .select("message")
        .maybeSingle();
      
      if (data?.message) {
        const firstName = transaction.customer_name?.split(" ")[0] || "";
        const formatted = data.message
          .replace(/{saudação}/g, getGreeting())
          .replace(/{saudacao}/g, getGreeting())
          .replace(/{nome}/g, transaction.customer_name || "")
          .replace(/{primeiro_nome}/g, firstName)
          .replace(/{valor}/g, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(transaction.amount)));
        setMessage(formatted);
      }
    };

    if (isOpen) {
      fetchMessage();
    }
  }, [isOpen, transaction]);

  const registerClick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("pix_card_recovery_clicks")
      .insert({
        transaction_id: transaction.id,
        user_id: user.id,
      });
    
    setClickCount(prev => prev + 1);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopied(false), 2000);
    await registerClick();
  };

  const handleOpenChat = async () => {
    if (!transaction.customer_phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }

    // Primeiro copia a mensagem
    await navigator.clipboard.writeText(message);

    // Depois abre o chat sem enviar mensagem
    const phone = transaction.customer_phone.replace(/\D/g, "");
    await openChat(phone);
    
    toast.success("Mensagem copiada! Cole com Ctrl+V");
    setIsOpen(false);
    await registerClick();
  };

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-success hover:bg-success/10 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <WhatsAppIcon className="h-4 w-4" />
          {clickCount > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-muted text-muted-foreground"
            >
              {clickCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-3" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Recuperação Rápida</h4>
            <div className="flex items-center gap-2">
              {clickCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {clickCount}x tentativa{clickCount > 1 ? "s" : ""}
                </span>
              )}
              <span className="text-xs text-muted-foreground capitalize">{transaction.type}</span>
            </div>
          </div>
          
          <div className="p-2.5 bg-secondary/30 rounded-lg border border-border/30">
            <p className="text-sm whitespace-pre-wrap">{message || "Carregando..."}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              Copiar
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 h-8 text-xs bg-success hover:bg-success/90"
              onClick={handleOpenChat}
              disabled={!transaction.customer_phone}
            >
              <WhatsAppIcon className="h-3.5 w-3.5 mr-1" />
              WhatsApp
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
