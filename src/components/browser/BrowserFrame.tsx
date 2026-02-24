import { Loader2 } from "lucide-react";

interface BrowserFrameProps {
  proxyUrl: string | null;
  loading: boolean;
}

export function BrowserFrame({ proxyUrl, loading }: BrowserFrameProps) {
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
    <div className="flex-1 relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {proxyUrl && (
        <iframe
          src={proxyUrl}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          title="Browser"
        />
      )}
    </div>
  );
}
