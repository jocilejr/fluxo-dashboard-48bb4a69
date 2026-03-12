import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL = 30_000; // 30s

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
    // Immediately push activity change
    if (sessionIdRef.current) {
      supabase
        .from("member_sessions")
        .update({
          ...update,
          last_heartbeat_at: new Date().toISOString(),
        } as any)
        .eq("id", sessionIdRef.current)
        .then(() => {});
    }
  }, []);

  useEffect(() => {
    if (!active || !normalizedPhone) return;

    let cancelled = false;

    const startSession = async () => {
      const { data } = await supabase
        .from("member_sessions")
        .insert({
          normalized_phone: normalizedPhone,
          current_activity: "viewing_home",
          page_url: window.location.pathname,
          user_agent: navigator.userAgent.slice(0, 255),
        } as any)
        .select("id")
        .single();

      if (cancelled || !data) return;
      sessionIdRef.current = data.id;

      // Start heartbeat
      heartbeatRef.current = setInterval(async () => {
        if (!sessionIdRef.current) return;
        await supabase
          .from("member_sessions")
          .update({
            last_heartbeat_at: new Date().toISOString(),
            ...activityRef.current,
          } as any)
          .eq("id", sessionIdRef.current);
      }, HEARTBEAT_INTERVAL);
    };

    startSession();

    const endSession = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (sessionIdRef.current) {
        // Use sendBeacon for reliability on page unload
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/member_sessions?id=eq.${sessionIdRef.current}`;
        const body = JSON.stringify({ ended_at: new Date().toISOString() });
        const sent = navigator.sendBeacon?.(
          url,
          new Blob([body], { type: "application/json" })
        );
        // sendBeacon doesn't support custom headers easily, fall back to fetch
        if (!sent) {
          fetch(url, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              Prefer: "return=minimal",
            },
            body,
            keepalive: true,
          }).catch(() => {});
        }
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
