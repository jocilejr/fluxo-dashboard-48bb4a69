import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { Activity, Clock, Wifi, WifiOff, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";
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

interface MemberSummary {
  key: string;
  phone: string;
  name: string | null;
  isOnline: boolean;
  latestActivity: string;
  latestProductName: string | null;
  latestMaterialName: string | null;
  firstAccess: string;
  lastAccess: string;
  totalMinutes: number;
  totalSessions: number;
}

const ACTIVITY_LABELS: Record<string, string> = {
  viewing_home: "Na página inicial",
  viewing_product: "Visualizando produto",
  reading_pdf: "Lendo PDF",
  watching_video: "Assistindo vídeo",
  viewing_offer: "Visualizando oferta",
};

function getActivityLabelFromSummary(summary: MemberSummary): string {
  const base = ACTIVITY_LABELS[summary.latestActivity] || summary.latestActivity;
  if (summary.latestMaterialName) return `${base} — ${summary.latestMaterialName}`;
  if (summary.latestProductName) return `${base} — ${summary.latestProductName}`;
  return base;
}

function isSessionOnline(session: MemberSession): boolean {
  if (session.ended_at) return false;
  const diff = differenceInSeconds(new Date(), new Date(session.last_heartbeat_at));
  return diff < 90;
}

function getSessionDurationMins(session: MemberSession): number {
  let end: Date;
  if (session.ended_at) {
    end = new Date(session.ended_at);
  } else {
    const hbAge = differenceInSeconds(new Date(), new Date(session.last_heartbeat_at));
    end = hbAge > 90 ? new Date(session.last_heartbeat_at) : new Date();
  }
  return Math.max(0, differenceInMinutes(end, new Date(session.started_at)));
}

function formatDuration(mins: number): string {
  if (mins < 1) return "< 1min";
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
}

/** Group key: last 8 digits of phone */
function phoneGroupKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-8);
}

export default function MemberActivityTab() {
  const [now, setNow] = useState(new Date());
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const { data: sessions, refetch } = useQuery({
    queryKey: ["member-sessions-recent"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("member_sessions")
        .select("*")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) {
        console.error("[MemberActivity] Failed to load sessions:", error);
        toast.error("Erro ao carregar sessões");
      }
      const rows = (data || []) as MemberSession[];

      // Auto-close orphaned sessions
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const orphaned = rows.filter(s => !s.ended_at && new Date(s.last_heartbeat_at) < fiveMinAgo);
      if (orphaned.length > 0) {
        for (const s of orphaned) {
          supabase.from("member_sessions")
            .update({ ended_at: s.last_heartbeat_at })
            .eq("id", s.id)
            .then(({ error: e }) => { if (e) console.error("[MemberActivity] Failed to close orphan:", e); });
          s.ended_at = s.last_heartbeat_at;
        }
      }

      return rows;
    },
    refetchInterval: 30_000,
  });

  // Get customer names
  const uniquePhones = useMemo(() => {
    if (!sessions) return [];
    return [...new Set(sessions.map((s: MemberSession) => s.normalized_phone))];
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

  // Build consolidated member summaries using 8-digit grouping
  const memberSummaries = useMemo((): MemberSummary[] => {
    if (!sessions?.length) return [];

    const groups = new Map<string, MemberSession[]>();
    for (const s of sessions) {
      const key = phoneGroupKey(s.normalized_phone);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    const summaries: MemberSummary[] = [];
    for (const [key, memberSessions] of groups) {
      // Sort by started_at desc to get latest first
      const sorted = [...memberSessions].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      const latest = sorted[0];
      const oldest = sorted[sorted.length - 1];

      const online = sorted.some(isSessionOnline);
      const latestOnline = online ? sorted.find(isSessionOnline)! : latest;

      const totalMins = sorted.reduce((sum, s) => sum + getSessionDurationMins(s), 0);

      // Find name from any phone variation
      const name = sorted.map(s => phoneNameMap[s.normalized_phone]).find(Boolean) || null;

      // Last access = most recent heartbeat or started_at
      const lastAccessDate = sorted.reduce((max, s) => {
        const t = Math.max(new Date(s.started_at).getTime(), new Date(s.last_heartbeat_at).getTime());
        return t > max ? t : max;
      }, 0);

      summaries.push({
        key,
        phone: latest.normalized_phone,
        name,
        isOnline: online,
        latestActivity: latestOnline.current_activity,
        latestProductName: latestOnline.current_product_name,
        latestMaterialName: latestOnline.current_material_name,
        firstAccess: oldest.started_at,
        lastAccess: new Date(lastAccessDate).toISOString(),
        totalMinutes: totalMins,
        totalSessions: sorted.length,
      });
    }

    // Online first, then by last access desc
    summaries.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime();
    });

    return summaries;
  }, [sessions, phoneNameMap, now]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("member-sessions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member_sessions" }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const onlineCount = useMemo(() => memberSummaries.filter(m => m.isOnline).length, [memberSummaries]);
  const uniqueVisitorsToday = memberSummaries.length;
  const totalSessions = sessions?.length || 0;

  const avgDurationMins = useMemo(() => {
    const withTime = memberSummaries.filter(m => m.totalMinutes > 0);
    if (!withTime.length) return 0;
    return Math.round(withTime.reduce((sum, m) => sum + m.totalMinutes, 0) / withTime.length);
  }, [memberSummaries]);

  const handleSimulateSession = async () => {
    setSimulating(true);
    try {
      const testPhone = "5500000000000";
      const { data, error } = await supabase.from("member_sessions").insert({
        normalized_phone: testPhone,
        current_activity: "viewing_home",
        page_url: "/teste-simulado",
        user_agent: "Teste Admin",
      }).select("id").single();

      if (error) {
        console.error("[SimulateSession] Error:", error);
        toast.error(`Erro ao simular: ${error.message}`);
      } else {
        toast.success(`Sessão de teste criada (ID: ${data.id})`);
        refetch();
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleSimulateSession} disabled={simulating} className="gap-2">
          <FlaskConical className="h-4 w-4" />
          {simulating ? "Simulando..." : "Simular sessão de teste"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            <p className="text-2xl font-bold text-primary">{onlineCount}</p>
          </div>
          <p className="text-xs text-muted-foreground">Online agora</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{uniqueVisitorsToday}</p>
          <p className="text-xs text-muted-foreground">Visitantes (24h)</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{totalSessions}</p>
          <p className="text-xs text-muted-foreground">Sessões (24h)</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{avgDurationMins}min</p>
          <p className="text-xs text-muted-foreground">Tempo médio</p>
        </Card>
      </div>

      {/* Online Members */}
      {onlineCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Wifi className="h-4 w-4 text-primary" /> Membros Online
            </h3>
            <div className="space-y-2">
              {memberSummaries.filter(m => m.isOnline).map((member) => (
                <div key={member.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.name || member.phone}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{getActivityLabelFromSummary(member)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{formatDuration(member.totalMinutes)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consolidated Member History */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" /> Membros (24h)
          </h3>
          {!memberSummaries.length ? (
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
                    <TableHead>Última Atividade</TableHead>
                    <TableHead>Primeiro Acesso</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Tempo Total</TableHead>
                    <TableHead className="text-center">Acessos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberSummaries.map((member) => (
                    <TableRow key={member.key}>
                      <TableCell className="font-medium text-sm">
                        {member.name || member.phone}
                      </TableCell>
                      <TableCell>
                        {member.isOnline ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
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
                        {getActivityLabelFromSummary(member)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(member.firstAccess), "HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(member.lastAccess), "HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDuration(member.totalMinutes)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold">{member.totalSessions}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
