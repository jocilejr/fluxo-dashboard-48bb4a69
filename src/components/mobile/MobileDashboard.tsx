import { useMemo, useState, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay, subDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from "recharts";

export function MobileDashboard() {
  const { transactions, isLoading, refetch } = useTransactions();
  const [isRealAdmin, setIsRealAdmin] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [daysBack, setDaysBack] = useState(7);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsRealAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsRealAdmin(data?.role === "admin");
    };
    checkRole();
  }, []);

  const { data: financialSettings } = useQuery({
    queryKey: ["financial-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isRealAdmin === true,
  });

  // Chart data with daily revenue and hourly breakdown
  const chartData = useMemo(() => {
    const now = new Date();
    const data: { date: string; label: string; revenue: number; count: number; transactions: any[] }[] = [];
    
    for (let i = daysBack - 1; i >= 0; i--) {
      const dayStart = startOfDay(subDays(now, i));
      const dayEnd = endOfDay(subDays(now, i));
      
      const dayTransactions = transactions.filter((t) => {
        if (t.status !== "pago") return false;
        const dateStr = t.paid_at || t.created_at;
        const date = new Date(dateStr);
        return date >= dayStart && date <= dayEnd;
      });
      
      const revenue = dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      
      data.push({
        date: format(dayStart, "yyyy-MM-dd"),
        label: i === 0 ? "Hoje" : i === 1 ? "Ontem" : format(dayStart, "dd/MM", { locale: ptBR }),
        revenue,
        count: dayTransactions.length,
        transactions: dayTransactions,
      });
    }
    
    return data;
  }, [transactions, daysBack]);

  // Total revenue for period
  const totalRevenue = useMemo(() => {
    return chartData.reduce((sum, d) => sum + d.revenue, 0);
  }, [chartData]);

  const totalSales = useMemo(() => {
    return chartData.reduce((sum, d) => sum + d.count, 0);
  }, [chartData]);

  // Today's hourly breakdown
  const todayHourlyData = useMemo(() => {
    const today = chartData.find(d => d.label === "Hoje");
    if (!today) return [];
    
    const hourlyMap: Record<number, { hour: string; revenue: number; count: number }> = {};
    
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { hour: `${h.toString().padStart(2, "0")}h`, revenue: 0, count: 0 };
    }
    
    today.transactions.forEach((t) => {
      const date = new Date(t.paid_at || t.created_at);
      const hour = date.getHours();
      hourlyMap[hour].revenue += Number(t.amount);
      hourlyMap[hour].count += 1;
    });
    
    return Object.values(hourlyMap).filter(h => h.count > 0);
  }, [chartData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-bold text-success">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 bg-background min-h-full">
        <div className="h-48 bg-card rounded-2xl animate-pulse" />
        <div className="h-32 bg-card rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-background min-h-full">
      {/* Pull to refresh */}
      <div className="flex justify-center">
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Revenue Chart Card - Admin only */}
      {isRealAdmin && (
        <div className="rounded-2xl bg-gradient-to-br from-card to-card/80 border border-border/50 overflow-hidden">
          {/* Header with total */}
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground font-medium">Faturamento</p>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setDaysBack(Math.max(3, daysBack - 3))}
                  className="p-1 hover:bg-secondary/50 rounded"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <span className="text-[10px] text-muted-foreground w-12 text-center">{daysBack} dias</span>
                <button 
                  onClick={() => setDaysBack(Math.min(30, daysBack + 3))}
                  className="p-1 hover:bg-secondary/50 rounded"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <p className="text-2xl font-bold text-success tracking-tight">
              {formatCurrency(totalRevenue)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-success/10 rounded-full text-[10px] text-success font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>{totalSales} vendas</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-32 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  hide 
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(var(--success))", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Today's Sales Timeline - Admin only */}
      {isRealAdmin && todayHourlyData.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/50 p-4">
          <p className="text-xs text-muted-foreground font-medium mb-3">Vendas de Hoje por Hora</p>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={todayHourlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis 
                  dataKey="hour" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Sales - Shows for everyone */}
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <p className="text-xs text-muted-foreground font-medium mb-3">Vendas Recentes</p>
        <div className="space-y-2">
          {transactions
            .filter(t => t.status === "pago")
            .slice(0, 5)
            .map((t) => {
              const date = new Date(t.paid_at || t.created_at);
              return (
                <div 
                  key={t.id}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.customer_name || "Cliente"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(date, "HH:mm", { locale: ptBR })} • {format(date, "dd/MM", { locale: ptBR })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-success ml-3">
                    {formatCurrency(Number(t.amount))}
                  </p>
                </div>
              );
            })}
          
          {transactions.filter(t => t.status === "pago").length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Nenhuma venda ainda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
