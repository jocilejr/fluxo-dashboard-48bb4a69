import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, RefreshCw, Download, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "action";
  category: string;
  message: string;
  details?: string;
}

// Global log storage
const LOG_STORAGE_KEY = "dashboard_activity_logs";
const MAX_LOGS = 500;

export const addActivityLog = (log: Omit<ActivityLog, "id" | "timestamp">) => {
  const logs = getActivityLogs();
  const newLog: ActivityLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  
  const updatedLogs = [newLog, ...logs].slice(0, MAX_LOGS);
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updatedLogs));
  
  // Dispatch event for real-time updates
  window.dispatchEvent(new CustomEvent("activity-log-added", { detail: newLog }));
  
  return newLog;
};

export const getActivityLogs = (): ActivityLog[] => {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const clearActivityLogs = () => {
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify([]));
  window.dispatchEvent(new CustomEvent("activity-logs-cleared"));
};

const ActivityLogs = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    setLogs(getActivityLogs());
    
    const handleLogAdded = () => setLogs(getActivityLogs());
    const handleLogsCleared = () => setLogs([]);
    
    window.addEventListener("activity-log-added", handleLogAdded);
    window.addEventListener("activity-logs-cleared", handleLogsCleared);
    
    return () => {
      window.removeEventListener("activity-log-added", handleLogAdded);
      window.removeEventListener("activity-logs-cleared", handleLogsCleared);
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = !filterType || log.type === filterType;
    const matchesCategory = !filterCategory || log.category === filterCategory;
    
    return matchesSearch && matchesType && matchesCategory;
  });

  const categories = [...new Set(logs.map(l => l.category))];
  
  const getTypeBadge = (type: ActivityLog["type"]) => {
    const variants: Record<string, string> = {
      info: "bg-info/20 text-info border-info/30",
      success: "bg-success/20 text-success border-success/30",
      warning: "bg-warning/20 text-warning border-warning/30",
      error: "bg-destructive/20 text-destructive border-destructive/30",
      action: "bg-primary/20 text-primary border-primary/30",
    };
    return variants[type] || variants.info;
  };

  const exportLogs = () => {
    const csvContent = [
      ["Timestamp", "Tipo", "Categoria", "Mensagem", "Detalhes"].join(","),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.type,
        log.category,
        `"${log.message.replace(/"/g, '""')}"`,
        `"${(log.details || "").replace(/"/g, '""')}"`,
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `logs_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card/60 border border-border/30 rounded-xl p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Logs de Atividade</h3>
            <p className="text-xs text-muted-foreground">
              {filteredLogs.length} de {logs.length} registros
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLogs(getActivityLogs())}
              className="h-8"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
              className="h-8"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => {
                if (confirm("Limpar todos os logs?")) {
                  clearActivityLogs();
                }
              }}
              disabled={logs.length === 0}
              className="h-8"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Limpar
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nos logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-secondary/30 border-border/30"
            />
          </div>
          
          <div className="flex gap-2">
            <select 
              value={filterType || ""} 
              onChange={(e) => setFilterType(e.target.value || null)}
              className="h-8 px-2 text-xs rounded-md border border-border/30 bg-secondary/30 text-foreground"
            >
              <option value="">Todos os tipos</option>
              <option value="info">Info</option>
              <option value="success">Sucesso</option>
              <option value="warning">Alerta</option>
              <option value="error">Erro</option>
              <option value="action">Ação</option>
            </select>
            
            <select 
              value={filterCategory || ""} 
              onChange={(e) => setFilterCategory(e.target.value || null)}
              className="h-8 px-2 text-xs rounded-md border border-border/30 bg-secondary/30 text-foreground"
            >
              <option value="">Todas categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <ScrollArea className="h-[400px] rounded-lg border border-border/20 bg-secondary/10">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {logs.length === 0 ? "Nenhum log registrado" : "Nenhum log encontrado"}
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-3 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 ${getTypeBadge(log.type)}`}
                      >
                        {log.type.toUpperCase()}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {log.category}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.timestamp), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground">{log.message}</p>
                  {log.details && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono break-all">
                      {log.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default ActivityLogs;
