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
  evolution_response: Record<string, unknown> | null;
  transaction_id: string | null;
  abandoned_event_id: string | null;
  sent_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

export function EvolutionMessageLogs() {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['evolution-message-logs', page, typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('evolution_message_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (typeFilter !== 'all') {
        query = query.eq('message_type', typeFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as MessageLog[], total: count || 0 };
    },
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Enviado</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Falhou</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'boleto':
        return 'Boleto';
      case 'pix_card':
        return 'PIX/Cartão';
      case 'abandoned':
        return 'Abandonado';
      default:
        return type;
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    if (phone.length === 12) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Log de Mensagens</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="pix_card">PIX/Cartão</SelectItem>
                <SelectItem value="abandoned">Abandonado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !data?.logs?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(log.message_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhone(log.phone)}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.error_message || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages} ({data?.total} registros)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Mensagem</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Data/Hora</label>
                  <p className="font-medium">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Tipo</label>
                  <p className="font-medium">{getTypeLabel(selectedLog.message_type)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Telefone</label>
                  <p className="font-medium font-mono">{formatPhone(selectedLog.phone)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Mensagem Enviada</label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <label className="text-sm text-muted-foreground">Erro</label>
                  <div className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm text-red-400">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.evolution_response && (
                <div>
                  <label className="text-sm text-muted-foreground">Resposta da Evolution API</label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.evolution_response, null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedLog.transaction_id && (
                  <div>
                    <label className="text-muted-foreground">ID Transação</label>
                    <p className="font-mono text-xs">{selectedLog.transaction_id}</p>
                  </div>
                )}
                {selectedLog.abandoned_event_id && (
                  <div>
                    <label className="text-muted-foreground">ID Evento Abandonado</label>
                    <p className="font-mono text-xs">{selectedLog.abandoned_event_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
