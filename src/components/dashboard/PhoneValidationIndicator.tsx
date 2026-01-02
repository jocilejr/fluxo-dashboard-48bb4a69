import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PhoneValidationIndicatorProps {
  status: 'pending' | 'valid' | 'invalid' | 'error' | null;
  errorMessage?: string;
}

export function PhoneValidationIndicator({ status, errorMessage }: PhoneValidationIndicatorProps) {
  if (status === null) {
    return null;
  }

  if (status === 'pending') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Validando número...</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'valid') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-success font-medium">Número existe no WhatsApp</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'invalid') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-destructive font-medium">Número NÃO existe no WhatsApp</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'error') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <AlertCircle className="h-3.5 w-3.5 text-warning" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="text-warning font-medium">Erro na validação</p>
              {errorMessage && <p className="text-xs">{errorMessage}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
