import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RecoveryStatusIndicatorProps {
  status: 'sent' | 'failed' | 'pending' | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}

export function RecoveryStatusIndicator({ status, errorMessage, sentAt }: RecoveryStatusIndicatorProps) {
  if (status === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <Minus className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sem recuperação automática</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (status === 'sent') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium text-success">Recuperação enviada!</p>
              {sentAt && <p className="text-xs">Enviado em {formatDate(sentAt)}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'failed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium text-destructive">Recuperação falhou</p>
              {errorMessage && <p className="text-xs">{errorMessage}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'pending') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning animate-pulse" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Recuperação pendente...</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
