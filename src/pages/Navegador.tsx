import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrowserSessions } from "@/hooks/useBrowserSessions";
import { BrowserToolbar } from "@/components/browser/BrowserToolbar";
import { BrowserSidebar } from "@/components/browser/BrowserSidebar";
import { BrowserFrame } from "@/components/browser/BrowserFrame";

export default function Navegador() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { sessions, saveCurrentUrl, deleteSession, togglePin, lastSession } = useBrowserSessions(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Auto-load last session
  useEffect(() => {
    if (lastSession && !currentUrl && userId) {
      navigateToUrl(lastSession.url);
    }
  }, [lastSession, userId]);

  const navigateToUrl = useCallback(async (url: string) => {
    setCurrentUrl(url);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("browser-proxy", {
        body: { url },
      });
      if (error) throw error;
      
      // Create blob URL from HTML content
      const blob = new Blob([data.html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      setProxyUrl(blobUrl);
      
      // Save session
      saveCurrentUrl(url, data.title || undefined);
    } catch (err) {
      console.error("[Browser] Proxy error:", err);
      setProxyUrl(null);
    } finally {
      setLoading(false);
    }
  }, [saveCurrentUrl]);

  const handleReload = () => {
    if (currentUrl) navigateToUrl(currentUrl);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <BrowserSidebar
        sessions={sessions}
        currentUrl={currentUrl}
        onSelect={navigateToUrl}
        onDelete={deleteSession}
        onTogglePin={togglePin}
      />
      <div className="flex-1 flex flex-col">
        <BrowserToolbar
          currentUrl={currentUrl}
          onNavigate={navigateToUrl}
          onReload={handleReload}
          loading={loading}
        />
        <BrowserFrame proxyUrl={proxyUrl} loading={loading} />
      </div>
    </div>
  );
}
