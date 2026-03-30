import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MessageLog {
  id: string;
  phone: string;
  message: string;
  message_type: string;
  status: string;
  error_message: string | null;
  external_response: Record<string, unknown> | null;
  external_message_id: string | null;
  transaction_id: string | null;
  abandoned_event_id: string | null;
  sent_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

export function MessageLogs() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['message-logs', page, statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('message_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('message_type', typeFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: (data || []) as MessageLog[], total: count || 0 };
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Enviada</Badge>;
      case 'read':
        return <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Lida</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Falha</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">Pendente</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'boleto':
        return <Badge variant="outline" className="text-[10px]">📄 Boleto</Badge>;
      case 'pix_card':
        return <Badge variant="outline" className="text-[10px]">💳 PIX/Cartão</Badge>;
      case 'abandoned':
        return <Badge variant="outline" className="text-[10px]">🛒 Abandono</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <Card className="bg-card/60 border-border/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Logs de Mensagens</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="failed">Falha</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="pix_card">PIX/Cartão</SelectItem>
              <SelectItem value="abandoned">Abandono</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhum log encontrado</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Telefone</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono">{log.phone}</TableCell>
                    <TableCell>{getTypeBadge(log.message_type)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">{total} registros</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs">{page + 1} / {totalPages || 1}</span>
                <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">Detalhes da Mensagem</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-mono">{selectedLog.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {getStatusBadge(selectedLog.status)}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    {getTypeBadge(selectedLog.message_type)}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Enviada em</p>
                    <p>{selectedLog.sent_at ? format(new Date(selectedLog.sent_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "Não enviada"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Mensagem</p>
                  <p className="p-2 bg-secondary/30 rounded text-xs whitespace-pre-wrap">{selectedLog.message}</p>
                </div>
                {selectedLog.error_message && (
                  <div>
                    <p className="text-muted-foreground mb-1">Erro</p>
                    <p className="p-2 bg-destructive/10 rounded text-xs text-destructive">{selectedLog.error_message}</p>
                  </div>
                )}
                {selectedLog.external_response && (
                  <div>
                    <p className="text-muted-foreground mb-1">Resposta da API</p>
                    <pre className="p-2 bg-secondary/30 rounded text-[10px] overflow-auto max-h-40">
                      {JSON.stringify(selectedLog.external_response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
