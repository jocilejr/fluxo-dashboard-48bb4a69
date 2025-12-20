import { useState } from "react";
import { ExternalLink, History, TrendingUp, TrendingDown, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Group {
  id: string;
  name: string;
  current_members: number;
  total_entries: number;
  total_exits: number;
  whatsapp_id: string | null;
  batch_number: number | null;
  whatsapp_url: string | null;
  active_link: string | null;
  updated_at: string;
}

interface GroupsTableProps {
  groups: Group[];
  onViewHistory: (group: Group) => void;
  onDeleteGroup: (group: Group) => void;
}

export function GroupsTable({ groups, onViewHistory, onDeleteGroup }: GroupsTableProps) {
  const [search, setSearch] = useState("");

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg font-semibold text-foreground">
            Todos os Grupos
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Grupo</TableHead>
                <TableHead className="text-center">Envio</TableHead>
                <TableHead className="text-center">Membros</TableHead>
                <TableHead className="text-center">Entradas</TableHead>
                <TableHead className="text-center">Saídas</TableHead>
                <TableHead>Link Ativo</TableHead>
                <TableHead className="text-center">Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {search ? "Nenhum grupo encontrado" : "Nenhum grupo cadastrado"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-foreground">{group.name}</span>
                        {group.whatsapp_id && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {group.whatsapp_id}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {group.batch_number ? (
                        <Badge variant="outline">#{group.batch_number}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-foreground">
                        {group.current_members.toLocaleString("pt-BR")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-green-500">
                        <TrendingUp className="h-3 w-3" />
                        <span>{group.total_entries.toLocaleString("pt-BR")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-red-500">
                        <TrendingDown className="h-3 w-3" />
                        <span>{group.total_exits.toLocaleString("pt-BR")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {group.active_link ? (
                        <Badge variant="secondary" className="max-w-[120px] truncate">
                          {group.active_link}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm">
                      {formatDate(group.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewHistory(group)}
                          title="Ver histórico"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {group.whatsapp_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="Abrir no WhatsApp"
                          >
                            <a
                              href={group.whatsapp_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteGroup(group)}
                          title="Remover grupo"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
