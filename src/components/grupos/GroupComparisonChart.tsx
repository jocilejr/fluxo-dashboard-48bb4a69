import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Group {
  id: string;
  name: string;
  current_members: number;
  total_entries: number;
  total_exits: number;
}

interface GroupComparisonChartProps {
  groups: Group[];
}

export function GroupComparisonChart({ groups }: GroupComparisonChartProps) {
  // Get top 10 groups by members for chart
  const chartData = groups
    .slice(0, 10)
    .map((group) => ({
      name: group.name.length > 25 ? group.name.substring(0, 22) + "..." : group.name,
      fullName: group.name,
      membros: group.current_members,
      entradas: group.total_entries,
      saidas: group.total_exits,
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{data.fullName}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-500">Membros: {data.membros.toLocaleString("pt-BR")}</p>
            <p className="text-green-500">Entradas: {data.entradas.toLocaleString("pt-BR")}</p>
            <p className="text-red-500">Saídas: {data.saidas.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (groups.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Comparativo de Grupos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          Nenhum dado disponível
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Top 10 Grupos por Membros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                wrapperStyle={{ paddingBottom: 20 }}
              />
              <Bar 
                dataKey="membros" 
                fill="hsl(var(--primary))" 
                name="Membros" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="entradas" 
                fill="#22c55e" 
                name="Entradas" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="saidas" 
                fill="#ef4444" 
                name="Saídas" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
