import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Calendar,
  Loader2,
  Phone,
  Trash2,
  Download,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

const filterOptions = [
  { value: "pending", label: "Pendentes", icon: Clock, color: "text-yellow-500" },
  { value: "overdue", label: "Atrasados", icon: AlertTriangle, color: "text-red-500" },
  { value: "today", label: "Hoje", icon: Calendar, color: "text-blue-500" },
  { value: "completed", label: "Concluídos", icon: CheckCircle2, color: "text-green-500" },
];

export default function Lembretes() {
  const [filter, setFilter] = useState("pending");
  const [createOpen, setCreateOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    phone: "",
    title: "",
    description: "",
    due_date: "",
  });
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["reminders", filter],
    queryFn: async () => {
      let query = supabase
        .from("reminders")
        .select("*")
        .order("due_date", { ascending: true });

      if (filter === "completed") {
        query = query.eq("completed", true);
      } else if (filter === "pending") {
        query = query.eq("completed", false);
      } else if (filter === "overdue") {
        query = query.eq("completed", false).lt("due_date", new Date().toISOString());
      } else if (filter === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        query = query
          .eq("completed", false)
          .gte("due_date", start.toISOString())
          .lte("due_date", end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (reminder: typeof newReminder) => {
      const { error } = await supabase.from("reminders").insert({
        phone: reminder.phone,
        title: reminder.title,
        description: reminder.description || null,
        due_date: new Date(reminder.due_date).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lembrete criado!");
      setCreateOpen(false);
      setNewReminder({ phone: "", title: "", description: "", due_date: "" });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("reminders").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lembrete excluído");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const handleCreate = () => {
    if (!newReminder.phone || !newReminder.title || !newReminder.due_date) {
      toast.error("Preencha telefone, título e data");
      return;
    }
    createMutation.mutate(newReminder);
  };

  const activeFilter = filterOptions.find(f => f.value === filter);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
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
            onClick={() => queryClient.invalidateQueries({ queryKey: ["reminders"] })}
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
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
                    onChange={e => setNewReminder(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    placeholder="Ex: Ligar para confirmar pagamento"
                    value={newReminder.title}
                    onChange={e => setNewReminder(p => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    placeholder="Detalhes do lembrete..."
                    value={newReminder.description}
                    onChange={e => setNewReminder(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="datetime-local"
                    value={newReminder.due_date}
                    onChange={e => setNewReminder(p => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar Lembrete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {filterOptions.map(opt => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(opt.value)}
            className="gap-2"
          >
            <opt.icon className={`h-4 w-4 ${filter !== opt.value ? opt.color : ""}`} />
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : reminders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">
              Nenhum lembrete {activeFilter?.label.toLowerCase()}
            </p>
            <Button variant="link" size="sm" onClick={() => setCreateOpen(true)}>
              Criar primeiro lembrete
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder: any) => {
            const isOverdue = !reminder.completed && isPast(new Date(reminder.due_date));
            return (
              <Card key={reminder.id} className="transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-4 py-4">
                  <Checkbox
                    checked={reminder.completed}
                    onCheckedChange={() =>
                      toggleMutation.mutate({ id: reminder.id, completed: !reminder.completed })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${reminder.completed ? "line-through text-muted-foreground" : ""}`}>
                        {reminder.title}
                      </span>
                      {reminder.completed && (
                        <Badge variant="secondary" className="text-xs">Concluído</Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                      )}
                    </div>
                    {reminder.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {reminder.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {reminder.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {(() => {
                          try {
                            return format(new Date(reminder.due_date), "dd/MM/yyyy HH:mm", { locale: ptBR });
                          } catch {
                            return reminder.due_date;
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(reminder.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
