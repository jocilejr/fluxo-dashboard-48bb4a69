import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { 
  Bot, 
  RefreshCw, 
  ArrowLeft, 
  CalendarIcon, 
  Users, 
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Activity,
  Zap,
  MessageSquare,
  Search,
  Sparkles,
  Loader2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type DateFilter = "today" | "yesterday" | "week" | "month" | "custom";

interface TypebotItem {
  id: string;
  name: string;
  count: number;
  completed: number;
}

interface TypebotAnalytics {
  totalLeads: number;
  completedLeads: number;
  incompletedLeads: number;
  completionRate: number;
  funnelSteps: { blockId: string; name: string; count: number; percentage: string }[];
  dropOffPoints: { blockId: string; name: string; count: number; percentage: string }[];
  peakHour: { hour: number; count: number } | null;
  hourlyDistribution: { hour: number; count: number }[];
}

interface LeadDataItem {
  id: string;
  phone: string | null;
  createdAt: string | null;
  responses: { field: string; question: string | null; aiResponse: string | null; value: string }[];
}

interface CategoryData {
  name: string;
  count: number;
}

interface AiCategorizedData {
  categories: CategoryData[];
  leads: LeadDataItem[];
  leadsAnalyzed: number;
  totalResponses: number;
}

interface LeadLog {
  id: string;
  createdAt: string;
  isCompleted: boolean;
  answers: { field: string; type?: string; question?: string | null; aiResponse?: string | null; value: string }[];
  aiResponses?: { name: string; value: string }[];
}

export default function TypebotRanking() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [selectedTypebot, setSelectedTypebot] = useState<TypebotItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [logSearch, setLogSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [aiData, setAiData] = useState<AiCategorizedData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(now);
    
    switch (dateFilter) {
      case "today":
        return { from: today, to: todayEnd };
      case "yesterday":
        const yesterday = subDays(today, 1);
        return { from: yesterday, to: endOfDay(yesterday) };
      case "week":
        return { from: startOfWeek(now, { weekStartsOn: 0 }), to: todayEnd };
      case "month":
        return { from: startOfMonth(now), to: todayEnd };
      case "custom":
        return {
          from: customRange?.from ? startOfDay(customRange.from) : today,
          to: customRange?.to ? endOfDay(customRange.to) : todayEnd,
        };
      default:
        return { from: today, to: todayEnd };
    }
  };

  const dateRange = getDateRange();

  const { data: ranking, isLoading, error, refetch, isRefetching } = useQuery<TypebotItem[]>({
    queryKey: ["typebot-ranking", dateFilter, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("typebot-stats", {
        body: {
          action: "ranking",
          fromDate: dateRange.from.toISOString(),
          toDate: dateRange.to.toISOString(),
        },
      });
      if (error) throw error;
      return data.ranking || [];
    },
    staleTime: 60000,
  });

  const { data: typebotDetails, isLoading: detailsLoading } = useQuery<{ typebot: { id: string; name: string }; analytics: TypebotAnalytics; logs: LeadLog[] }>({
    queryKey: ["typebot-details", selectedTypebot?.id, dateFilter, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("typebot-stats", {
        body: {
          action: "details",
          typebotId: selectedTypebot?.id,
          fromDate: dateRange.from.toISOString(),
          toDate: dateRange.to.toISOString(),
        },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTypebot && showDetails,
  });

  // Get unique stages for filter
  const uniqueStages = typebotDetails?.logs
    ? [...new Set(typebotDetails.logs.flatMap(log => log.answers.map(a => a.field)))]
    : [];

  // Filter logs by search and stage
  const filteredLogs = typebotDetails?.logs?.filter(log => {
    const matchesSearch = !logSearch || log.answers.some(a => 
      a.value.toLowerCase().includes(logSearch.toLowerCase())
    );
    const matchesStage = stageFilter === "all" || log.answers.some(a => a.field === stageFilter);
    return matchesSearch && matchesStage;
  }) || [];

  // Filter answers by stage if stage filter is active
  const getFilteredAnswers = (answers: { field: string; value: string }[]) => {
    if (stageFilter === "all") return answers;
    return answers.filter(a => a.field === stageFilter);
  };

  const totalLeads = ranking?.reduce((sum, item) => sum + item.count, 0) || 0;
  const totalCompleted = ranking?.reduce((sum, item) => sum + item.completed, 0) || 0;
  const avgCompletionRate = totalLeads > 0 ? ((totalCompleted / totalLeads) * 100).toFixed(1) : "0";
  const topPerformers = ranking?.filter(t => t.count > 0).slice(0, 5) || [];
  const lowPerformers = ranking?.filter(t => t.count > 0).sort((a, b) => a.count - b.count).slice(0, 5) || [];

  const filterButtons = [
    { key: "today" as DateFilter, label: "Hoje" },
    { key: "yesterday" as DateFilter, label: "Ontem" },
    { key: "week" as DateFilter, label: "Semana" },
    { key: "month" as DateFilter, label: "Mês" },
    { key: "custom" as DateFilter, label: "Personalizado" },
  ];

  const handleTypebotClick = (typebot: TypebotItem) => {
    setSelectedTypebot(typebot);
    setShowDetails(true);
    setAiData(null);
    setSelectedCategory(null);
  };

  const generateAiSummary = async () => {
    if (!typebotDetails?.logs || typebotDetails.logs.length === 0) {
      toast({ title: "Sem dados", description: "Não há leads para analisar", variant: "destructive" });
      return;
    }
    
    setIsGeneratingSummary(true);
    setAiData(null);
    setSelectedCategory(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("lead-summary", {
        body: {
          typebotId: selectedTypebot?.id,
          typebotName: selectedTypebot?.name,
          leads: typebotDetails.logs.map(log => ({
            id: log.id,
            createdAt: log.createdAt,
            isCompleted: log.isCompleted,
            answers: log.answers.map(a => ({ 
              key: a.field, 
              type: a.type || 'unknown', 
              question: a.question || null, 
              aiResponse: a.aiResponse || null,
              value: a.value 
            }))
          }))
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setAiData(data);
      toast({ title: "Análise concluída!", description: `${data.totalResponses} respostas categorizadas` });
    } catch (err: any) {
      console.error("Error generating summary:", err);
      toast({ title: "Erro", description: err.message || "Erro ao analisar", variant: "destructive" });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // No longer need getDisplayResponses - we display leads directly

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/")}
                className="gap-2 text-slate-400 hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Typebots Analytics</h1>
                  <p className="text-xs text-slate-500">
                    {format(dateRange.from, "dd MMM", { locale: ptBR })} - {format(dateRange.to, "dd MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-2 text-slate-400 hover:text-white hover:bg-white/5"
            >
              <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Date Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {filterButtons.map((btn) => (
            <Button
              key={btn.key}
              variant="ghost"
              size="sm"
              onClick={() => setDateFilter(btn.key)}
              className={cn(
                "rounded-full px-4 transition-all",
                dateFilter === btn.key 
                  ? "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 hover:text-violet-300" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {btn.label}
            </Button>
          ))}
          {dateFilter === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 rounded-full border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white">
                  <CalendarIcon className="h-4 w-4" />
                  {customRange?.from && customRange?.to ? (
                    `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`
                  ) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-white/10 bg-slate-900" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customRange?.from}
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={1}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-violet-500 data-[state=active]:text-white text-slate-400">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="typebots" className="data-[state=active]:bg-violet-500 data-[state=active]:text-white text-slate-400">
              <Bot className="h-4 w-4 mr-2" />
              Typebots
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
                      <Users className="h-6 w-6 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total de Leads</p>
                      <p className="text-3xl font-bold text-white">{totalLeads.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Concluídos</p>
                      <p className="text-3xl font-bold text-white">{totalCompleted.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                      <Target className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Taxa de Conclusão</p>
                      <p className="text-3xl font-bold text-white">{avgCompletionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                      <Activity className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Typebots Ativos</p>
                      <p className="text-3xl font-bold text-white">{ranking?.filter(t => t.count > 0).length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top & Low Performers */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    Mais Leads
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 bg-white/5" />)
                  ) : topPerformers.length > 0 ? (
                    topPerformers.map((typebot, i) => (
                      <button
                        key={typebot.id}
                        onClick={() => handleTypebotClick(typebot)}
                        className="flex w-full items-center gap-4 rounded-lg bg-white/5 p-3 text-left transition-all hover:bg-white/10"
                      >
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                          i === 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-400"
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-white">{typebot.name}</p>
                          <p className="text-xs text-slate-500">{typebot.completed} concluídos</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-400">{typebot.count}</p>
                          <p className="text-xs text-slate-500">leads</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </button>
                    ))
                  ) : (
                    <p className="py-8 text-center text-slate-500">Nenhum lead no período</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <TrendingDown className="h-5 w-5 text-rose-400" />
                    Menos Leads
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 bg-white/5" />)
                  ) : lowPerformers.length > 0 ? (
                    lowPerformers.map((typebot, i) => (
                      <button
                        key={typebot.id}
                        onClick={() => handleTypebotClick(typebot)}
                        className="flex w-full items-center gap-4 rounded-lg bg-white/5 p-3 text-left transition-all hover:bg-white/10"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-sm font-bold">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-white">{typebot.name}</p>
                          <p className="text-xs text-slate-500">{typebot.completed} concluídos</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-rose-400">{typebot.count}</p>
                          <p className="text-xs text-slate-500">leads</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </button>
                    ))
                  ) : (
                    <p className="py-8 text-center text-slate-500">Nenhum lead no período</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Typebots Tab */}
          <TabsContent value="typebots" className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-white/5" />)}
              </div>
            ) : error ? (
              <Card className="border-white/5 bg-white/5">
                <CardContent className="py-12 text-center">
                  <p className="text-rose-400 mb-2">Erro ao carregar dados</p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
                </CardContent>
              </Card>
            ) : ranking && ranking.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ranking.map((typebot) => {
                  const completionRate = typebot.count > 0 ? (typebot.completed / typebot.count * 100) : 0;
                  return (
                    <button
                      key={typebot.id}
                      onClick={() => handleTypebotClick(typebot)}
                      className="group relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 text-left transition-all hover:border-violet-500/30 hover:bg-white/10"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                          <Bot className="h-5 w-5 text-violet-400" />
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                          typebot.count > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                        )}>
                          <Zap className="h-3 w-3" />
                          {typebot.count > 0 ? "Ativo" : "Inativo"}
                        </div>
                      </div>
                      <h3 className="mb-2 font-semibold text-white line-clamp-2">{typebot.name}</h3>
                      <div className="mb-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{typebot.count}</span>
                        <span className="text-sm text-slate-500">leads</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Taxa de conclusão</span>
                          <span className="text-slate-300">{completionRate.toFixed(0)}%</span>
                        </div>
                        <Progress value={completionRate} className="h-1.5 bg-white/10" />
                      </div>
                      <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <Card className="border-white/5 bg-white/5">
                <CardContent className="py-12 text-center">
                  <Bot className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                  <p className="text-slate-500">Nenhum typebot encontrado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20">
                <Bot className="h-5 w-5 text-violet-400" />
              </div>
              {selectedTypebot?.name}
            </DialogTitle>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="grid grid-cols-2 gap-4 py-4">
              <Skeleton className="h-48 bg-white/5" />
              <Skeleton className="h-48 bg-white/5" />
            </div>
          ) : typebotDetails ? (
            <Tabs defaultValue="analytics" className="space-y-4">
              <TabsList className="bg-white/5 border border-white/10 p-1">
                <TabsTrigger value="analytics" className="data-[state=active]:bg-violet-500 data-[state=active]:text-white text-slate-400">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="logs" className="data-[state=active]:bg-violet-500 data-[state=active]:text-white text-slate-400">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Logs ({typebotDetails.logs?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Logs Tab */}
              <TabsContent value="logs" className="space-y-4">
                {/* Filters Row */}
                <div className="flex gap-3 flex-wrap items-center">
                  <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Buscar..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-8 text-sm"
                    />
                  </div>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white h-8 text-sm">
                      <SelectValue placeholder="Filtrar etapa" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 max-h-[300px]">
                      <SelectItem value="all" className="text-white hover:bg-white/10">Todas as etapas</SelectItem>
                      {uniqueStages.map((stage) => (
                        <SelectItem key={stage} value={stage} className="text-white hover:bg-white/10 text-sm">
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-slate-500">
                    {filteredLogs.length} lead{filteredLogs.length !== 1 ? 's' : ''}
                  </div>
                  {stageFilter !== "all" && (
                    <button 
                      onClick={() => setStageFilter("all")} 
                      className="text-xs bg-violet-500/20 text-violet-400 px-2 py-1 rounded hover:bg-violet-500/30 flex items-center gap-1"
                    >
                      {stageFilter} <span className="text-violet-300">×</span>
                    </button>
                  )}
                </div>

                {/* Logs Grid */}
                <ScrollArea className="h-[420px] pr-4">
                  {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <MessageSquare className="h-10 w-10 mb-3 opacity-50" />
                      <p>Nenhum lead encontrado</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredLogs.map((log) => {
                        const displayAnswers = getFilteredAnswers(log.answers);
                        return (
                          <div 
                            key={log.id} 
                            className={cn(
                              "rounded-lg border p-3 transition-all hover:border-violet-500/30",
                              log.isCompleted 
                                ? "bg-emerald-500/5 border-emerald-500/20" 
                                : "bg-white/[0.02] border-white/10"
                            )}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "w-2 h-2 rounded-full",
                                  log.isCompleted ? "bg-emerald-400" : "bg-rose-400"
                                )} />
                                <span className="text-xs font-medium text-white">
                                  {format(new Date(log.createdAt), "HH:mm")}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {format(new Date(log.createdAt), "dd/MM", { locale: ptBR })}
                                </span>
                              </div>
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                log.isCompleted 
                                  ? "bg-emerald-500/20 text-emerald-400" 
                                  : "bg-rose-500/20 text-rose-400"
                              )}>
                                {log.isCompleted ? "Concluído" : "Abandonou"}
                              </span>
                            </div>
                            
                            {/* Answers */}
                            {displayAnswers.length > 0 ? (
                              <div className="space-y-1.5">
                                {displayAnswers.map((answer, i) => (
                                  <div key={i} className="text-xs">
                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wide">
                                      {answer.field}
                                    </span>
                                    <span className="text-slate-200 line-clamp-2" title={answer.value}>
                                      {answer.value || "-"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600 italic">Sem respostas registradas</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-5">
              {/* AI Summary Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateAiSummary}
                    disabled={isGeneratingSummary || !typebotDetails?.logs?.length}
                    className="gap-2 border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300"
                  >
                    {isGeneratingSummary ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Gerar Resumo com IA
                  </Button>
                </div>

                {/* AI Categorized Data Display */}
                {aiData && (
                  <div className="space-y-4">
                    {/* Category Badges - Top Section (Dúvidas Recorrentes) */}
                    <div className="rounded-lg bg-slate-800/50 border border-white/10 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-violet-400" />
                        <span className="text-sm font-medium text-slate-300">Dúvidas Recorrentes</span>
                        <span className="text-xs text-slate-500">({aiData.totalResponses} respostas de {aiData.leadsAnalyzed} leads)</span>
                      </div>
                      
                      {aiData.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {aiData.categories.map((cat, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            >
                              {cat.name} ({cat.count})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">Nenhuma categoria identificada</p>
                      )}
                    </div>

                    {/* Leads List - Grouped by Person */}
                    <div className="rounded-lg bg-white/[0.02] border border-white/10">
                      <div className="p-3 border-b border-white/5 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">Respostas por Lead</span>
                        <span className="text-xs text-slate-500">
                          {aiData.leads.length} leads
                        </span>
                      </div>
                      
                      <ScrollArea className="h-[350px]">
                        <div className="p-3 space-y-3">
                          {aiData.leads.map((lead, idx) => (
                            <div 
                              key={lead.id} 
                              className="rounded-lg bg-white/5 border border-white/5 overflow-hidden"
                            >
                              {/* Lead Header */}
                              <div className="flex items-center gap-3 p-3 bg-white/5 border-b border-white/5">
                                <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Users className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-sm font-medium text-slate-200">Lead #{idx + 1}</span>
                                    {lead.phone && (
                                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                        {lead.phone}
                                      </span>
                                    )}
                                    {lead.createdAt && (
                                      <span className="text-xs text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-slate-500">{lead.responses.length} respostas</span>
                              </div>
                              
                              {/* Lead Responses - Simple List */}
                              <div className="p-3 space-y-2">
                                {lead.responses.map((resp, respIdx) => (
                                  <div key={respIdx} className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
                                    <span className="text-[10px] text-violet-400 block mb-1">{resp.field || 'Resposta'}</span>
                                    <p className="text-sm text-slate-200">{resp.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          
                          {aiData.leads.length === 0 && (
                            <p className="text-center text-slate-500 py-8 text-sm">
                              Nenhum lead com inputs de texto
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}

                {/* Quick Stats - Horizontal Row */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      Total
                    </div>
                    <p className="text-xl font-bold">{typebotDetails.analytics.totalLeads}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluídos
                    </div>
                    <p className="text-xl font-bold text-emerald-400">{typebotDetails.analytics.completedLeads}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs mb-1">
                      <XCircle className="h-3.5 w-3.5" />
                      Abandonos
                    </div>
                    <p className="text-xl font-bold text-rose-400">{typebotDetails.analytics.incompletedLeads}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs mb-1">
                      <Target className="h-3.5 w-3.5" />
                      Conversão
                    </div>
                    <p className="text-xl font-bold text-amber-400">{typebotDetails.analytics.completionRate}%</p>
                  </div>
                </div>

                {/* Hourly Distribution Chart */}
                {typebotDetails.analytics.hourlyDistribution && typebotDetails.analytics.hourlyDistribution.length > 0 && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4">
                    <h4 className="flex items-center gap-2 mb-4 font-medium text-sm">
                      <Clock className="h-4 w-4 text-violet-400" />
                      Leads por Hora
                    </h4>
                    <div className="flex items-end gap-[2px] h-28">
                      {Array.from({ length: 24 }, (_, hour) => {
                        const hourData = typebotDetails.analytics.hourlyDistribution.find(h => h.hour === hour);
                        const count = hourData?.count || 0;
                        const maxCount = Math.max(...typebotDetails.analytics.hourlyDistribution.map(h => h.count), 1);
                        const heightPercent = count > 0 ? Math.max((count / maxCount) * 100, 8) : 4;
                        const isPeakHour = typebotDetails.analytics.peakHour?.hour === hour;
                        return (
                          <div key={hour} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            <div 
                              className={cn(
                                "w-full rounded-t transition-all min-h-[4px]",
                                isPeakHour ? "bg-violet-500" : count > 0 ? "bg-violet-500/60" : "bg-white/10",
                                "hover:bg-violet-400"
                              )}
                              style={{ height: `${heightPercent}%` }}
                            />
                            {count > 0 && (
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                {hour}h: {count} lead{count > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-[2px] mt-1">
                      {Array.from({ length: 24 }, (_, hour) => (
                        <div key={hour} className="flex-1 text-center">
                          <span className="text-[8px] text-slate-500">{hour}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Two Column Layout */}
                <div className="grid grid-cols-2 gap-5">
                  {/* Left Column - Peak Hour & Drop-off */}
                  <div className="space-y-4">
                    {/* Peak Hour */}
                    {typebotDetails.analytics.peakHour && (
                      <div className="flex items-center gap-3 rounded-lg bg-violet-500/10 border border-violet-500/20 p-3">
                        <Clock className="h-5 w-5 text-violet-400 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400">Horário de pico</p>
                          <p className="font-semibold text-sm">
                            {typebotDetails.analytics.peakHour.hour}:00 - {typebotDetails.analytics.peakHour.hour + 1}:00
                            <span className="ml-1.5 text-xs text-slate-400">({typebotDetails.analytics.peakHour.count} leads)</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Drop-off Points */}
                    {typebotDetails.analytics.dropOffPoints.length > 0 && (
                      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4">
                        <h4 className="flex items-center gap-2 mb-3 font-medium text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          Pontos de Abandono
                        </h4>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {typebotDetails.analytics.dropOffPoints.map((point, i) => (
                            <div key={point.blockId} className="flex items-center gap-2 rounded-md bg-white/5 p-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-xs">{point.name}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-sm text-amber-400">{point.count}</p>
                                <p className="text-[10px] text-slate-500">{point.percentage}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Funnel Steps */}
                  <div>
                    {typebotDetails.analytics.funnelSteps.length > 0 && (
                      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 h-full">
                        <h4 className="flex items-center gap-2 mb-3 font-medium text-sm">
                          <BarChart3 className="h-4 w-4 text-violet-400" />
                          Etapas do Funil
                        </h4>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                          {typebotDetails.analytics.funnelSteps.map((step) => (
                            <div key={step.blockId} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="truncate text-slate-300 max-w-[60%]">{step.name}</span>
                                <span className="text-slate-500">{step.count} ({step.percentage}%)</span>
                              </div>
                              <Progress value={Number(step.percentage)} className="h-1.5 bg-white/10" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="py-8 text-center text-slate-500">Erro ao carregar detalhes</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
