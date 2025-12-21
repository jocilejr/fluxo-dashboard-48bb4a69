import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { GroupsTable } from "@/components/grupos/GroupsTable";
import { GroupComparisonChart } from "@/components/grupos/GroupComparisonChart";
import { GroupHistoryModal } from "@/components/grupos/GroupHistoryModal";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useSelectedGroups } from "@/hooks/useSelectedGroups";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

export default function Grupos() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const queryClient = useQueryClient();
  const { selectedGroupIds, toggleGroup, selectAll, clearSelection } = useSelectedGroups();

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups-page"] });
      toast.success("Grupo removido com sucesso");
      setGroupToDelete(null);
    },
    onError: () => {
      toast.error("Erro ao remover grupo");
    },
  });

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("current_members", { ascending: false });
      if (error) throw error;
      return data as Group[];
    },
  });

  // Real-time subscription for automatic updates
  useEffect(() => {
    const channel = supabase
      .channel('groups-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['groups-page'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter groups for stats based on selection
  const filteredGroupsForStats = useMemo(() => {
    if (!groups) return [];
    if (selectedGroupIds.length === 0) return groups; // Show all if none selected
    return groups.filter((g) => selectedGroupIds.includes(g.id));
  }, [groups, selectedGroupIds]);

  // Calculate totals based on filtered groups
  const stats = filteredGroupsForStats.reduce(
    (acc, group) => ({
      totalGroups: acc.totalGroups + 1,
      totalMembers: acc.totalMembers + (group.current_members || 0),
      totalEntries: acc.totalEntries + (group.total_entries || 0),
      totalExits: acc.totalExits + (group.total_exits || 0),
    }),
    { totalGroups: 0, totalMembers: 0, totalEntries: 0, totalExits: 0 }
  );

  const retentionRate = stats.totalEntries > 0 
    ? Math.round(((stats.totalEntries - stats.totalExits) / stats.totalEntries) * 100) 
    : 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const showingFiltered = selectedGroupIds.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grupos do WhatsApp</h1>
          <p className="text-muted-foreground">Análise detalhada de participantes e movimentação</p>
        </div>
        {showingFiltered && (
          <Badge variant="outline" className="self-start sm:self-auto">
            Estatísticas de {selectedGroupIds.length} grupo{selectedGroupIds.length > 1 ? "s" : ""} selecionado{selectedGroupIds.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {showingFiltered ? "Grupos Selecionados" : "Total de Grupos"}
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalGroups}</div>
            <p className="text-xs text-muted-foreground">
              {showingFiltered ? `de ${groups?.length || 0} grupos` : "grupos ativos"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Membros
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalMembers.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">participantes</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Entradas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +{stats.totalEntries.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">pessoas entraram</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Saídas
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -{stats.totalExits.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">
              pessoas saíram ({retentionRate}% retenção)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart - uses filtered groups */}
      <GroupComparisonChart groups={filteredGroupsForStats} />

      {/* Table - always shows all groups for selection */}
      <GroupsTable 
        groups={groups || []} 
        onViewHistory={(group) => setSelectedGroup(group)}
        onDeleteGroup={(group) => setGroupToDelete(group)}
        selectedGroupIds={selectedGroupIds}
        onToggleGroup={toggleGroup}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
      />

      {/* History Modal */}
      {selectedGroup && (
        <GroupHistoryModal
          group={selectedGroup}
          open={!!selectedGroup}
          onOpenChange={(open) => !open && setSelectedGroup(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o grupo "{groupToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => groupToDelete && deleteGroupMutation.mutate(groupToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
