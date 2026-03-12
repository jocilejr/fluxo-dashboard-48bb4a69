import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL = 30_000;

interface SessionUpdate {
  current_activity: string;
  current_product_name?: string | null;
  current_material_name?: string | null;
}

export function useMemberSession(normalizedPhone: string, active: boolean) {
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityRef = useRef<SessionUpdate>({ current_activity: "viewing_home" });

  const updateActivity = useCallback((update: SessionUpdate) => {
    activityRef.current = update;
    if (sessionIdRef.current) {
      supabase.from("member_sessions")
        .update({
          ...update,
          last_heartbeat_at: new Date().toISOString(),
        })
        .eq("id", sessionIdRef.current)
        .then(({ error }) => {
          if (error) console.error("[MemberSession] Failed to update activity:", error);
        });
    }
  }, []);

  useEffect(() => {
    console.log("[MemberSession] Effect triggered, active:", active, "phone:", normalizedPhone);
    if (!active || !normalizedPhone) return;

    let cancelled = false;

    const startSession = async () => {
      // Generate ID client-side to avoid needing SELECT permission
      const clientId = crypto.randomUUID();
      console.log("[MemberSession] Creating session with client-generated ID:", clientId);

      const { error } = await supabase.from("member_sessions")
        .insert({
          id: clientId,
          normalized_phone: normalizedPhone,
          current_activity: "viewing_home",
          page_url: window.location.pathname,
          user_agent: navigator.userAgent.slice(0, 255),
        });

      if (error) {
        console.error("[MemberSession] Failed to create session:", error);
        // Retry once after 5s
        if (!cancelled) {
          setTimeout(() => {
            if (cancelled) return;
            console.log("[MemberSession] Retrying session creation...");
            supabase.from("member_sessions")
              .insert({
                id: clientId,
                normalized_phone: normalizedPhone,
                current_activity: "viewing_home",
                page_url: window.location.pathname,
                user_agent: navigator.userAgent.slice(0, 255),
              })
              .then(({ error: retryErr }) => {
                if (retryErr) {
                  console.error("[MemberSession] Retry also failed:", retryErr);
                  return;
                }
                if (!cancelled) {
                  sessionIdRef.current = clientId;
                  console.log("[MemberSession] Session started on retry:", clientId);
                  startHeartbeat();
                }
              });
          }, 5000);
        }
        return;
      }

      if (cancelled) return;
      sessionIdRef.current = clientId;
      console.log("[MemberSession] Session started:", clientId);
      startHeartbeat();
    };

    const startHeartbeat = () => {
      heartbeatRef.current = setInterval(async () => {
        if (!sessionIdRef.current) return;
        const { error: hbError } = await supabase.from("member_sessions")
          .update({
            last_heartbeat_at: new Date().toISOString(),
            ...activityRef.current,
          })
          .eq("id", sessionIdRef.current);
        if (hbError) console.error("[MemberSession] Heartbeat failed:", hbError);
      }, HEARTBEAT_INTERVAL);
    };

    startSession();

    const endSession = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (sessionIdRef.current) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/member_sessions?id=eq.${sessionIdRef.current}`;
        const body = JSON.stringify({ ended_at: new Date().toISOString() });
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          Prefer: "return=minimal",
        };
        fetch(url, { method: "PATCH", headers, body, keepalive: true }).catch(() => {});
        console.log("[MemberSession] Session ended:", sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };

    const handleBeforeUnload = () => endSession();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      endSession();
    };
  }, [active, normalizedPhone]);

  return { updateActivity };
}
