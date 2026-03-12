import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Activity, Users, Clock, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, format, differenceInMinutes, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface MemberSession {
  id: string;
  normalized_phone: string;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  current_activity: string;
  current_product_name: string | null;
  current_material_name: string | null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  viewing_home: "Na página inicial",
  viewing_product: "Visualizando produto",
  reading_pdf: "Lendo PDF",
  watching_video: "Assistindo vídeo",
  viewing_offer: "Visualizando oferta",
};

function getActivityLabel(session: MemberSession): string {
  const base = ACTIVITY_LABELS[session.current_activity] || session.current_activity;
  if (session.current_material_name) return `${base} — ${session.current_material_name}`;
  if (session.current_product_name) return `${base} — ${session.current_product_name}`;
  return base;
}

function isOnline(session: MemberSession): boolean {
  if (session.ended_at) return false;
  const diff = differenceInSeconds(new Date(), new Date(session.last_heartbeat_at));
  return diff < 90; // 90s tolerance (heartbeat every 30s)
}

function SessionDuration({ startedAt, endedAt }: { startedAt: string; endedAt: string | null }) {
  const end = endedAt ? new Date(endedAt) : new Date();
  const mins = differenceInMinutes(end, new Date(startedAt));
  if (mins < 1) return <span>{"< 1min"}</span>;
  if (mins < 60) return <span>{mins}min</span>;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return <span>{h}h {m}min</span>;
}

export default function MemberActivityTab() {
  const [now, setNow] = useState(new Date());

  // Refresh "now" every 15s to update online indicators
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  // Recent sessions (last 24h)
  const { data: sessions, refetch } = useQuery({
    queryKey: ["member-sessions-recent"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("member_sessions")
        .select("*")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200);
      return (data || []) as MemberSession[];
    },
    refetchInterval: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("member-sessions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member_sessions" }, (payload) => {
        refetch();
        // Toast when someone leaves
        if (payload.eventType === "UPDATE" && (payload.new as any)?.ended_at && !(payload.old as any)?.ended_at) {
          const phone = (payload.new as any)?.normalized_phone || "";
          const name = phoneNameMap[phone] || phone;
          toast.info(`${name} saiu da área de membros`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  // Get customer names for phones
  const uniquePhones = useMemo(() => {
    if (!sessions) return [];
    return [...new Set(sessions.map(s => s.normalized_phone))];
  }, [sessions]);

  const { data: customers } = useQuery({
    queryKey: ["session-customers", uniquePhones],
    queryFn: async () => {
      if (!uniquePhones.length) return [];
      const allVars = uniquePhones.flatMap(p => generatePhoneVariations(p));
      const unique = [...new Set(allVars)];
      const { data } = await supabase.from("customers").select("normalized_phone, name").in("normalized_phone", unique);
      return data || [];
    },
    enabled: uniquePhones.length > 0,
  });

  const phoneNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!customers) return map;
    for (const phone of uniquePhones) {
      const vars = new Set(generatePhoneVariations(phone));
      const c = customers.find((cu: any) => vars.has(cu.normalized_phone));
      if (c?.name) map[phone] = c.name;
    }
    return map;
  }, [customers, uniquePhones]);

  const onlineSessions = useMemo(() => (sessions || []).filter(isOnline), [sessions, now]);
  const todaySessions = sessions || [];
  const uniqueVisitorsToday = useMemo(() => new Set(todaySessions.map(s => s.normalized_phone)).size, [todaySessions]);

  const avgDurationMins = useMemo(() => {
    const ended = todaySessions.filter(s => s.ended_at);
    if (!ended.length) return 0;
    const total = ended.reduce((sum, s) => sum + differenceInMinutes(new Date(s.ended_at!), new Date(s.started_at)), 0);
    return Math.round(total / ended.length);
  }, [todaySessions]);

  // Access count per phone
  const accessCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    (sessions || []).forEach(s => { map[s.normalized_phone] = (map[s.normalized_phone] || 0) + 1; });
    return map;
  }, [sessions]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-2xl font-bold text-emerald-600">{onlineSessions.length}</p>
          </div>
          <p className="text-xs text-muted-foreground">Online agora</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{uniqueVisitorsToday}</p>
          <p className="text-xs text-muted-foreground">Visitantes (24h)</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{todaySessions.length}</p>
          <p className="text-xs text-muted-foreground">Sessões (24h)</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{avgDurationMins}min</p>
          <p className="text-xs text-muted-foreground">Tempo médio</p>
        </Card>
      </div>

      {/* Online Members */}
      {onlineSessions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Wifi className="h-4 w-4 text-emerald-500" /> Membros Online
            </h3>
            <div className="space-y-2">
              {onlineSessions.map(session => (
                <div key={session.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {phoneNameMap[session.normalized_phone] || session.normalized_phone}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{getActivityLabel(session)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      <SessionDuration startedAt={session.started_at} endedAt={null} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" /> Histórico de Sessões (24h)
          </h3>
          {!todaySessions.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma sessão registrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead className="text-center">Acessos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todaySessions.map(session => {
                    const online = isOnline(session);
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium text-sm">
                          {phoneNameMap[session.normalized_phone] || session.normalized_phone}
                        </TableCell>
                        <TableCell>
                          {online ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <WifiOff className="h-3 w-3" />
                              Offline
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {getActivityLabel(session)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(session.started_at), "HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {session.ended_at
                            ? format(new Date(session.ended_at), "HH:mm", { locale: ptBR })
                            : "—"
                          }
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          <SessionDuration startedAt={session.started_at} endedAt={session.ended_at} />
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm font-semibold">{accessCountMap[session.normalized_phone] || 1}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
