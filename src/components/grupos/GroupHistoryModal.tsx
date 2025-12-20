import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Group {
  id: string;
  name: string;
  current_members: number;
  total_entries: number;
  total_exits: number;
}

interface GroupHistoryModalProps {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupHistoryModal({ group, open, onOpenChange }: GroupHistoryModalProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["group-history", group.id],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("group_statistics_history")
        .select("*")
        .eq("group_id", group.id)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const chartData = history?.map((item) => ({
    date: format(new Date(item.date), "dd/MM", { locale: ptBR }),
    entradas: item.entries,
    saidas: item.exits,
    membros: item.current_members,
  })) || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            {payload.map((item: any, index: number) => (
              <p key={index} style={{ color: item.color }}>
                {item.name}: {item.value.toLocaleString("pt-BR")}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Histórico: {group.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {group.current_members.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-muted-foreground">Membros Atuais</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-500">
                +{group.total_entries.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-500">
                -{group.total_exits.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-muted-foreground">Total Saídas</p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-80">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum histórico disponível para este grupo
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="membros"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Membros"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="entradas"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Entradas"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="saidas"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Saídas"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
