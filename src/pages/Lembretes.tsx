import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bell,
  Plus,
  RefreshCcw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Loader2,
  Phone,
  Trash2,
  Download,
  Circle,
  CheckCircle,
} from "lucide-react";
import {
  format,
  isPast,
  isToday,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Lembretes() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  const [newReminder, setNewReminder] = useState({
    phone: "",
    title: "",
    description: "",
    due_date: "",
  });
  const queryClient = useQueryClient();

  // Realtime subscription for reminders table
  useEffect(() => {
    const channel = supabase
      .channel('reminders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["reminders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch ALL reminders (filter in frontend for stats)
  const { data: allReminders = [], isLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Compute stats
  const stats = useMemo(() => {
    const now = new Date();
    const overdue = allReminders.filter(
      (r: any) => !r.completed && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))
    );
    const today = allReminders.filter(
      (r: any) => !r.completed && isToday(new Date(r.due_date))
    );
    const pending = allReminders.filter((r: any) => !r.completed);
    const completed = allReminders.filter((r: any) => r.completed);
    return { overdue, today, pending, completed };
  }, [allReminders]);

  // Days that have reminders (for calendar indicators)
  const reminderDates = useMemo(() => {
    const dates = new Set<string>();
    allReminders.forEach((r: any) => {
      if (!r.completed) {
        dates.add(format(new Date(r.due_date), "yyyy-MM-dd"));
      }
    });
    return dates;
  }, [allReminders]);

  // Filtered reminders for the list
  const filteredReminders = useMemo(() => {
    let list = allReminders;

    if (selectedDate) {
      list = list.filter((r: any) => isSameDay(new Date(r.due_date), selectedDate));
    } else if (filter === "overdue") {
      list = stats.overdue;
    } else if (filter === "today") {
      list = stats.today;
    } else if (filter === "pending") {
      list = stats.pending;
    } else if (filter === "completed") {
      list = stats.completed;
    }

    return list;
  }, [allReminders, filter, selectedDate, stats]);

  // Fire-and-forget outbound webhook
  const sendOutboundWebhook = (event: string, data: any) => {
    supabase.functions.invoke("send-outbound-webhook", {
      body: { event, data },
    }).catch((err) => console.error("Outbound webhook error:", err));
  };

  const createMutation = useMutation({
    mutationFn: async (reminder: typeof newReminder) => {
      const { data, error } = await supabase.from("reminders").insert({
        phone: reminder.phone,
        title: reminder.title,
        description: reminder.description || null,
        due_date: new Date(reminder.due_date).toISOString(),
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Lembrete criado!");
      setCreateOpen(false);
      setNewReminder({ phone: "", title: "", description: "", due_date: "" });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      sendOutboundWebhook("reminder_created", data);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed, external_id }: { id: string; completed: boolean; external_id?: string | null }) => {
      // Update locally
      const { error } = await supabase.from("reminders").update({ completed }).eq("id", id);
      if (error) throw error;

      // Sync with external API if has external_id
      if (external_id) {
        try {
          const { data, error: fnError } = await supabase.functions.invoke("external-reminders", {
            body: { action: "update", reminder_id: external_id, completed },
          });
          if (fnError) {
            console.error("External sync error:", fnError);
            toast.warning("Atualizado localmente, mas falhou ao sincronizar com API externa");
          } else {
            console.log("External sync response:", data);
          }
        } catch (e) {
          console.error("External sync failed:", e);
          toast.warning("Atualizado localmente, mas falhou ao sincronizar com API externa");
        }
      } else {
        console.log("No external_id for reminder", id, "- skipping external sync");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      sendOutboundWebhook("reminder_updated", { id: variables.id, completed: variables.completed, external_id: variables.external_id });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Lembrete excluído");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      sendOutboundWebhook("reminder_deleted", { id });
    },
  });

  const handleCreate = () => {
    if (!newReminder.phone || !newReminder.title || !newReminder.due_date) {
      toast.error("Preencha telefone, título e data");
      return;
    }
    createMutation.mutate(newReminder);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date && selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(undefined); // deselect
    } else {
      setSelectedDate(date);
      if (date) setFilter("all");
    }
  };

  const handleFilterClick = (f: string) => {
    setSelectedDate(undefined);
    setFilter(f === filter ? "all" : f);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Lembretes</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie lembretes e follow-ups dos seus contatos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              toast.info("Importando lembretes...");
              try {
                const { data, error } = await supabase.functions.invoke("sync-reminders");
                if (error) throw error;
                if (data?.success) {
                  toast.success(`Importados: ${data.imported} novos, ${data.skipped} atualizados`);
                  queryClient.invalidateQueries({ queryKey: ["reminders"] });
                } else {
                  toast.error(data?.error || "Erro ao importar");
                }
              } catch (err: any) {
                toast.error("Erro: " + (err.message || ""));
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["reminders"] })}
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Lembrete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Lembrete</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="5511999999999"
                    value={newReminder.phone}
                    onChange={(e) => setNewReminder((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    placeholder="Ex: Ligar para confirmar pagamento"
                    value={newReminder.title}
                    onChange={(e) => setNewReminder((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    placeholder="Detalhes do lembrete..."
                    value={newReminder.description}
                    onChange={(e) => setNewReminder((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="datetime-local"
                    value={newReminder.due_date}
                    onChange={(e) => setNewReminder((p) => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Criar Lembrete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${filter === "overdue" && !selectedDate ? "ring-2 ring-destructive" : ""}`}
          onClick={() => handleFilterClick("overdue")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdue.length}</p>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${filter === "today" && !selectedDate ? "ring-2 ring-yellow-500" : ""}`}
          onClick={() => handleFilterClick("today")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-500/10">
              <CalendarIcon className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.today.length}</p>
              <p className="text-xs text-muted-foreground">Para hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${filter === "pending" && !selectedDate ? "ring-2 ring-orange-500" : ""}`}
          onClick={() => handleFilterClick("pending")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-500/10">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending.length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${filter === "completed" && !selectedDate ? "ring-2 ring-green-500" : ""}`}
          onClick={() => handleFilterClick("completed")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed.length}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Body: Calendar + List */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Calendar */}
        <Card className="h-fit">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={ptBR}
              className="pointer-events-auto"
              modifiers={{
                hasReminder: (date) =>
                  reminderDates.has(format(date, "yyyy-MM-dd")),
              }}
              modifiersStyles={{
                hasReminder: {},
              }}
              components={{
                DayContent: ({ date, ...props }) => {
                  const hasReminder = reminderDates.has(format(date, "yyyy-MM-dd"));
                  return (
                    <div className="relative flex items-center justify-center w-full h-full">
                      <span>{date.getDate()}</span>
                      {hasReminder && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
                      )}
                    </div>
                  );
                },
              }}
            />
            {selectedDate && (
              <div className="mt-2 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(undefined)}
                >
                  Limpar seleção
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reminders list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {selectedDate
                ? `Lembretes de ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                : filter === "overdue"
                ? "Lembretes Atrasados"
                : filter === "today"
                ? "Lembretes de Hoje"
                : filter === "pending"
                ? "Lembretes Pendentes"
                : filter === "completed"
                ? "Lembretes Concluídos"
                : "Todos os Lembretes"}
            </h2>
            <Badge variant="secondary">{filteredReminders.length}</Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredReminders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Bell className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground font-medium">
                  Nenhum lembrete encontrado
                </p>
                <Button variant="link" size="sm" onClick={() => setCreateOpen(true)}>
                  Criar primeiro lembrete
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredReminders.map((reminder: any) => {
                const isOverdue =
                  !reminder.completed &&
                  isPast(new Date(reminder.due_date)) &&
                  !isToday(new Date(reminder.due_date));
                const isTodayReminder = isToday(new Date(reminder.due_date));
                const isFuture = !reminder.completed && !isOverdue && !isTodayReminder;

                return (
                  <Card
                    key={reminder.id}
                    className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                      reminder.completed ? "opacity-60" : ""
                    } ${isOverdue ? "border-destructive/30" : ""}`}
                    onClick={() => setSelectedReminder(reminder)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium text-sm truncate ${reminder.completed ? "line-through text-muted-foreground" : ""}`}>
                          {reminder.title}
                        </span>
                        {isTodayReminder && !reminder.completed && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/20 shrink-0">
                            Hoje
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                            Atrasado
                          </Badge>
                        )}
                        {isFuture && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0">
                            Futuro
                          </Badge>
                        )}
                        {reminder.completed && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            Concluído
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {reminder.phone}
                        </span>
                        {reminder.instance_name && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
                            {reminder.instance_name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        {(() => {
                          try {
                            return format(new Date(reminder.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                          } catch {
                            return reminder.due_date;
                          }
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedReminder} onOpenChange={(open) => !open && setSelectedReminder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Detalhes do Lembrete
            </DialogTitle>
          </DialogHeader>
          {selectedReminder && (
            <ReminderDetail
              reminder={selectedReminder}
              onToggle={() => {
                toggleMutation.mutate({
                  id: selectedReminder.id,
                  completed: !selectedReminder.completed,
                  external_id: selectedReminder.external_id,
                });
                setSelectedReminder({ ...selectedReminder, completed: !selectedReminder.completed });
              }}
              onDelete={() => {
                deleteMutation.mutate(selectedReminder.id);
                setSelectedReminder(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReminderDetail({ reminder, onToggle, onDelete }: { reminder: any; onToggle: () => void; onDelete: () => void }) {
  const isOverdue = !reminder.completed && isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date));
  const isTodayReminder = isToday(new Date(reminder.due_date));
  const isFuture = !reminder.completed && !isOverdue && !isTodayReminder;

  const statusLabel = reminder.completed ? "Concluído" : isOverdue ? "Atrasado" : isTodayReminder ? "Hoje" : "Futuro";
  const statusColor = reminder.completed
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    : isOverdue
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : isTodayReminder
    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";

  return (
    <div className="space-y-5">
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Contato</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Título</p>
                <p className="font-medium text-sm">{reminder.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground">Telefone</p>
                <p className="font-medium text-sm">{reminder.phone}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  navigator.clipboard.writeText(reminder.phone);
                  toast.success("Copiado!");
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </Button>
            </div>
            {reminder.instance_name && (
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Instância</p>
                  <p className="font-medium text-sm">{reminder.instance_name}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${statusColor}`}>
                {statusLabel}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                {(() => {
                  try {
                    return format(new Date(reminder.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                  } catch {
                    return reminder.due_date;
                  }
                })()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {reminder.description && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Descrição</p>
            <p className="text-sm whitespace-pre-wrap">{reminder.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant={reminder.completed ? "outline" : "default"}
          className="flex-1 gap-2"
          onClick={onToggle}
        >
          {reminder.completed ? (
            <>
              <Circle className="h-4 w-4" />
              Reabrir
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Concluir
            </>
          )}
        </Button>
        <Button variant="destructive" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
