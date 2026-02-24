import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

export interface BrowserSession {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  favicon: string | null;
  last_accessed_at: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useBrowserSessions(userId: string | null) {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["browser-sessions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("browser_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("is_pinned", { ascending: false })
        .order("last_accessed_at", { ascending: false });
      if (error) throw error;
      return data as BrowserSession[];
    },
    enabled: !!userId,
    staleTime: 10000,
  });

  const upsertSession = useMutation({
    mutationFn: async ({ url, title, favicon }: { url: string; title?: string; favicon?: string }) => {
      if (!userId) throw new Error("No user");
      
      // Check if session with same URL exists
      const { data: existing } = await supabase
        .from("browser_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("url", url)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("browser_sessions")
          .update({ last_accessed_at: new Date().toISOString(), title, favicon })
          .eq("id", existing.id);
        if (error) throw error;
        return existing.id;
      } else {
        const { data, error } = await supabase
          .from("browser_sessions")
          .insert({ user_id: userId, url, title, favicon })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["browser-sessions", userId] }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("browser_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["browser-sessions", userId] }),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const { error } = await supabase
        .from("browser_sessions")
        .update({ is_pinned })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["browser-sessions", userId] }),
  });

  const saveCurrentUrl = useCallback(
    (url: string, title?: string) => {
      if (url && userId) upsertSession.mutate({ url, title });
    },
    [userId, upsertSession]
  );

  return {
    sessions,
    isLoading,
    saveCurrentUrl,
    deleteSession: deleteSession.mutate,
    togglePin: togglePin.mutate,
    lastSession: sessions[0] || null,
  };
}
