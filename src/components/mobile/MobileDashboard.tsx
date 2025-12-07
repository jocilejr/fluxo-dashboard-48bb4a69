import { useMemo, useState, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp,
  RefreshCw,
  Users,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";

export function MobileDashboard() {
  const { transactions, isLoading, refetch } = useTransactions();
  const [isRealAdmin, setIsRealAdmin] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Fetch groups data
  const { data: groups = [] } = useQuery({
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

  // Fetch group history for today (Brazil timezone)
  const { data: groupHistory = [] } = useQuery({
    queryKey: ["group-history-today"],
    queryFn: async () => {
      // Get current date in Brazil timezone (UTC-3)
      // Create a proper Brazil date by using the timezone offset
      const now = new Date();
      const brazilOffset = -3 * 60; // UTC-3 in minutes
      const utcOffset = now.getTimezoneOffset();
      const brazilTime = new Date(now.getTime() + (utcOffset + brazilOffset) * 60000);
      const today = format(brazilTime, "yyyy-MM-dd");
      
      console.log("[MobileDashboard] Fetching group history for Brazil date:", today);
      
      const { data, error } = await supabase
        .from("group_statistics_history")
        .select("*, groups(name)")
        .eq("date", today);
      if (error) throw error;
      console.log("[MobileDashboard] Group history data:", data);
      return data;
    },
  });

  // Today's revenue data (Brazil timezone)
  const todayData = useMemo(() => {
    const nowBrazil = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayStart = startOfDay(nowBrazil);
    const dayEnd = endOfDay(nowBrazil);
    
    const dayTransactions = transactions.filter((t) => {
      if (t.status !== "pago") return false;
      const dateStr = t.paid_at || t.created_at;
      const date = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return date >= dayStart && date <= dayEnd;
    });
    
    const revenue = dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    
    return {
      revenue,
      count: dayTransactions.length,
    };
  }, [transactions]);

  // Last 7 days chart data
  const last7DaysData = useMemo(() => {
    const nowBrazil = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(nowBrazil, i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const dayTransactions = transactions.filter((t) => {
        if (t.status !== "pago") return false;
        const dateStr = t.paid_at || t.created_at;
        const tDate = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        return tDate >= dayStart && tDate <= dayEnd;
      });
      
      const revenue = dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      
      days.push({
        day: format(date, "EEE", { locale: ptBR }),
        date: format(date, "dd/MM"),
        revenue,
        count: dayTransactions.length,
      });
    }
    
    return days;
  }, [transactions]);

  // Group totals
  const groupTotals = useMemo(() => {
    const totalMembers = groups.reduce((sum, g) => sum + (g.current_members || 0), 0);
    const totalEntries = groupHistory.reduce((sum, h) => sum + (h.entries || 0), 0);
    const totalExits = groupHistory.reduce((sum, h) => sum + (h.exits || 0), 0);
    return { totalMembers, totalEntries, totalExits };
  }, [groups, groupHistory]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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

      {/* Main Revenue Card - Admin only */}
      {isRealAdmin && (
        <div className="rounded-2xl bg-gradient-to-br from-success/10 via-card to-card border border-success/20 overflow-hidden">
          {/* Header */}
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">Faturamento Hoje</p>
              <span className="text-[10px] text-muted-foreground">Últimos 7 dias</span>
            </div>
            
            <p className="text-3xl font-bold text-success tracking-tight">
              {formatCurrency(todayData.revenue)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-success/10 rounded-full text-[10px] text-success font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>{todayData.count} vendas hoje</span>
              </div>
            </div>
          </div>

          {/* 7 Days Chart */}
          <div className="h-28 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7DaysData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGradientMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  fill="url(#revenueGradientMobile)"
                  dot={{ r: 3, fill: "hsl(var(--success))", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "hsl(var(--success))", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Group Members Card */}
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Membros no Grupo Hoje</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/30 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-foreground">{groupTotals.totalMembers}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Total</p>
            </div>
            <div className="bg-success/10 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                <p className="text-xl font-bold text-success">{groupTotals.totalEntries}</p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">Entradas</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                <p className="text-xl font-bold text-destructive">{groupTotals.totalExits}</p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">Saídas</p>
            </div>
          </div>

          {/* Individual Groups */}
          {groups.length > 0 && (
            <div className="mt-3 space-y-2">
              {groups.slice(0, 3).map((group) => {
                const history = groupHistory.find((h: any) => h.group_id === group.id);
                return (
                  <div 
                    key={group.id}
                    className="flex items-center justify-between py-2 px-3 bg-secondary/20 rounded-lg"
                  >
                    <p className="text-xs font-medium text-foreground truncate flex-1">
                      {group.name}
                    </p>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-muted-foreground">
                        {group.current_members} membros
                      </span>
                      {history && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-success">+{history.entries}</span>
                          <span className="text-destructive">-{history.exits}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 mt-2">
              Nenhum grupo configurado
            </p>
          )}
        </div>
      </div>

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
