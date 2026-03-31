import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, RotateCcw, CheckCircle2, XCircle, Clock, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MessageLog {
  id: string;
  phone: string;
  message: string;
  message_type: string;
  status: string;
  error_message: string | null;
  external_response: unknown;
  sent_at: string | null;
  created_at: string;
  transaction_id: string | null;
  abandoned_event_id: string | null;
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  sent: { label: "Enviada", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  failed: { label: "Falhou", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
};

const typeLabels: Record<string, string> = {
  boleto: "Boleto",
  pix_card: "PIX/Cartão",
  abandoned: "Abandono",
};

export function RecoveryLogsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["recovery-logs", statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("message_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (typeFilter !== "all") query = query.eq("message_type", typeFilter);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MessageLog[];
    },
    refetchInterval: 15000,
  });

  const retryMutation = useMutation({
    mutationFn: async (log: MessageLog) => {
      const { data, error } = await supabase.functions.invoke("send-external-message", {
        body: {
          phone: log.phone,
          message: log.message,
          transactionId: log.transaction_id,
          abandonedEventId: log.abandoned_event_id,
          messageType: log.message_type,
        },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao reenviar");
      return data;
    },
    onSuccess: () => {
      toast.success("Mensagem reenviada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["recovery-logs"] });
      queryClient.invalidateQueries({ queryKey: ["messaging-stats"] });
    },
    onError: (err: Error) => {
      toast.error(`Falha ao reenviar: ${err.message}`);
    },
  });

  const formatPhone = (phone: string) => {
    if (phone.length === 13) return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    if (phone.length === 12) return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    return phone;
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              Logs de Envio
            </CardTitle>
            <CardDescription className="text-xs">
              Histórico de tentativas de envio automático
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary/30 border-border/30">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="sent">Enviadas</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary/30 border-border/30">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="pix_card">PIX/Cartão</SelectItem>
              <SelectItem value="abandoned">Abandono</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground ml-auto">{logs.length} registros</span>
        </div>

        {/* Logs list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhum log encontrado
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const config = statusConfig[log.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              const isRetrying = retryMutation.isPending && retryMutation.variables?.id === log.id;

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20 hover:border-border/40 transition-colors"
                >
                  <StatusIcon className={`h-4 w-4 shrink-0 mt-0.5 ${log.status === 'sent' ? 'text-emerald-400' : log.status === 'failed' ? 'text-destructive' : 'text-amber-400'}`} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{formatPhone(log.phone)}</span>
                      <Badge variant="outline" className={`text-[9px] h-4 ${config.className}`}>
                        {config.label}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4">
                        {typeLabels[log.message_type] || log.message_type}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{log.message}</p>
                    {log.error_message && (
                      <p className="text-[10px] text-destructive/80 truncate">
                        Erro: {log.error_message}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                      {log.sent_at && ` · Enviado: ${format(new Date(log.sent_at), "HH:mm:ss")}`}
                    </p>
                  </div>
                  {log.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 shrink-0"
                      disabled={isRetrying}
                      onClick={() => retryMutation.mutate(log)}
                    >
                      {isRetrying ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Reenviar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
