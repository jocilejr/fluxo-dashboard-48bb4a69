import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { subDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { Skeleton } from "@/components/ui/skeleton";

interface GroupHistoryData {
  id: string;
  group_id: string;
  date: string;
  entries: number;
  exits: number;
  current_members: number;
}

const PERIODS = [
  { label: "3 dias", days: 3 },
  { label: "7 dias", days: 7 },
  { label: "10 dias", days: 10 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
];

export function GroupHistoryChart() {
  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["group-statistics-history"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("group_statistics_history")
        .select("*")
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as GroupHistoryData[];
    },
  });

  const getChartData = (days: number) => {
    if (!historyData || !groups) return [];

    const startDate = subDays(new Date(), days);
    const filtered = historyData.filter(
      (h) => new Date(h.date) >= startDate
    );

    // Group by date and aggregate - sum entries/exits and members across all groups
    const byDate = filtered.reduce((acc, item) => {
      const dateKey = item.date;
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          entries: 0,
          exits: 0,
          members: 0,
        };
      }
      acc[dateKey].entries += item.entries;
      acc[dateKey].exits += item.exits;
      acc[dateKey].members += item.current_members; // Sum all members from all groups
      return acc;
    }, {} as Record<string, { date: string; entries: number; exits: number; members: number }>);

    // Fill missing dates using Brazil timezone (America/Sao_Paulo)
    const result = [];
    const nowBrazil = toZonedTime(new Date(), "America/Sao_Paulo");
    
    for (let i = days; i >= 0; i--) {
      const dateBrazil = subDays(nowBrazil, i);
      const dateKey = formatInTimeZone(dateBrazil, "America/Sao_Paulo", "yyyy-MM-dd");
      const existing = byDate[dateKey];
      
      result.push({
        date: formatInTimeZone(dateBrazil, "America/Sao_Paulo", "dd/MM"),
        fullDate: dateKey,
        entries: existing?.entries || 0,
        exits: existing?.exits || 0,
        members: existing?.members || 0,
      });
    }

    return result;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico do Grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Histórico de Entradas e Saídas</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="7" className="w-full">
          <TabsList className="mb-4 flex-wrap">
            {PERIODS.map((period) => (
              <TabsTrigger key={period.days} value={String(period.days)}>
                {period.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {PERIODS.map((period) => (
            <TabsContent key={period.days} value={String(period.days)}>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getChartData(period.days)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="entries"
                      name="Entradas"
                      stroke="hsl(142, 76%, 36%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(142, 76%, 36%)", r: 3 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="exits"
                      name="Saídas"
                      stroke="hsl(0, 84%, 60%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(0, 84%, 60%)", r: 3 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="members"
                      name="Total de Membros"
                      stroke="hsl(217, 91%, 60%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(217, 91%, 60%)", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
