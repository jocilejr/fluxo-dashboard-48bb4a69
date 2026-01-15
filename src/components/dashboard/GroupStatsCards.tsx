import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, UserMinus, UsersRound } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Group {
  id: string;
  name: string;
  current_members: number;
  total_entries: number;
  total_exits: number;
  updated_at: string;
}

export function GroupStatsCards() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Group[];
    },
  });

  // Query today's stats from history table
  const { data: todayStats } = useQuery({
    queryKey: ["group-stats-today", selectedGroupId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      
      let query = supabase
        .from("group_statistics_history")
        .select("entries, exits")
        .eq("date", today);
      
      if (selectedGroupId !== "all") {
        query = query.eq("group_id", selectedGroupId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Sum entries and exits from today
      return data.reduce(
        (acc, row) => ({
          entries: acc.entries + (row.entries || 0),
          exits: acc.exits + (row.exits || 0),
        }),
        { entries: 0, exits: 0 }
      );
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("groups-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["groups"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_statistics_history" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group-stats-today"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const currentMembers = groups.reduce(
    (acc, group) => {
      if (selectedGroupId === "all" || selectedGroupId === group.id) {
        acc += group.current_members;
      }
      return acc;
    },
    0
  );

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UsersRound className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">Estatísticas de Grupos</h3>
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Selecione um grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Membros Atuais
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xl font-bold">{currentMembers}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-green-500" />
              Entradas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xl font-bold text-green-500">{todayStats?.entries || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <UserMinus className="h-3.5 w-3.5 text-red-500" />
              Saídas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xl font-bold text-red-500">{todayStats?.exits || 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}