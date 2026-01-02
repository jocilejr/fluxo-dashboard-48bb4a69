import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhoneValidationButtonProps {
  phone: string | null;
}

interface ValidationResult {
  exists: boolean | null;
  phone: string;
  isMobile: boolean;
  jid?: string;
  error?: string;
}

export function PhoneValidationButton({ phone }: PhoneValidationButtonProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleValidate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!phone) {
      toast.error("Número de telefone não disponível");
      return;
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-validate-number', {
        body: { phone }
      });

      if (error) {
        toast.error("Erro ao validar número");
        console.error(error);
        return;
      }

      setResult(data);
      setShowModal(true);

      if (data.error) {
        toast.error(data.error);
      } else if (data.exists === true) {
        toast.success("Número existe no WhatsApp!");
      } else if (data.exists === false) {
        toast.warning("Número NÃO existe no WhatsApp");
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error("Erro ao validar número");
    } finally {
      setIsValidating(false);
    }
  };

  if (!phone) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-info hover:bg-info/10"
              onClick={handleValidate}
              disabled={isValidating}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Validar número WhatsApp</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Validação de Número</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Número:</span>
              <span className="font-mono text-sm">{result?.phone || phone}</span>
            </div>
            
            {result?.error ? (
              <div className="flex items-center gap-3 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="text-sm">{result.error}</span>
              </div>
            ) : result?.exists === true ? (
              <div className="flex items-center gap-3 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Número existe no WhatsApp!</span>
              </div>
            ) : result?.exists === false ? (
              <div className="flex items-center gap-3 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Número NÃO existe no WhatsApp</span>
              </div>
            ) : null}

            {result && (
              <div className="pt-2 border-t space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Celular (tem 9):</span>
                  <span>{result.isMobile ? 'Sim' : 'Não'}</span>
                </div>
                {result.jid && (
                  <div className="flex justify-between">
                    <span>JID:</span>
                    <span className="font-mono">{result.jid}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
