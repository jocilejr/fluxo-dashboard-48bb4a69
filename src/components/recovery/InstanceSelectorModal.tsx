import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppInstance {
  instance_name: string;
  status?: string;
  [key: string]: unknown;
}

interface InstanceSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverUrl: string;
  apiKey: string;
  currentInstance: string | null;
  onSelect: (instanceName: string) => void;
  title: string;
}

export function InstanceSelectorModal({
  open,
  onOpenChange,
  serverUrl,
  apiKey,
  currentInstance,
  onSelect,
  title,
}: InstanceSelectorModalProps) {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && serverUrl && apiKey) {
      fetchInstances();
    }
  }, [open]);

  const fetchInstances = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-instances', {
        body: { server_url: serverUrl, api_key: apiKey },
      });
      if (fnError) throw new Error(fnError.message || 'Erro ao buscar instâncias');
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar instâncias');
      setInstances(data.instances || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar instâncias');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando instâncias...</span>
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              {error}
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={fetchInstances}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!isLoading && !error && instances.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma instância encontrada</p>
          )}
          {!isLoading && instances.map((inst) => (
            <button
              key={inst.instance_name}
              onClick={() => {
                onSelect(inst.instance_name);
                onOpenChange(false);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                currentInstance === inst.instance_name
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-secondary/20 border-border/20 hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span className="text-sm font-medium">{inst.instance_name}</span>
              </div>
              {inst.status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  inst.status === 'open' || inst.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {inst.status}
                </span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
