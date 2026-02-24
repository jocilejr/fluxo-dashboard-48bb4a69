import { useState } from "react";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrowserFrameProps {
  proxyUrl: string | null;
  loading: boolean;
  currentUrl?: string;
}

export function BrowserFrame({ proxyUrl, loading, currentUrl }: BrowserFrameProps) {
  const [iframeError, setIframeError] = useState(false);

  if (!proxyUrl && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">Digite uma URL para começar</p>
          <p className="text-sm text-muted-foreground/60">As sessões serão salvas automaticamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative flex flex-col">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {proxyUrl && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b border-border text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>Alguns sites (SPAs, bancos, redes sociais) podem não funcionar corretamente via proxy.</span>
            {currentUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs ml-auto"
                onClick={() => window.open(currentUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir original
              </Button>
            )}
          </div>
          <iframe
            src={proxyUrl}
            className="flex-1 w-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            title="Browser"
            onError={() => setIframeError(true)}
          />
        </>
      )}
    </div>
  );
}
