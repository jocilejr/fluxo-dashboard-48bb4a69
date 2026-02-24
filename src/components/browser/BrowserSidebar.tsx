import { Pin, PinOff, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BrowserSession } from "@/hooks/useBrowserSessions";

interface BrowserSidebarProps {
  sessions: BrowserSession[];
  currentUrl: string;
  onSelect: (url: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (params: { id: string; is_pinned: boolean }) => void;
}

export function BrowserSidebar({ sessions, currentUrl, onSelect, onDelete, onTogglePin }: BrowserSidebarProps) {
  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  };

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Sessões Salvas</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sessions.length} sessão(ões)</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma sessão salva</p>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                currentUrl === session.url
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50 text-foreground"
              }`}
              onClick={() => onSelect(session.url)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{session.title || getDomain(session.url)}</p>
                <p className="text-[10px] text-muted-foreground truncate">{getDomain(session.url)}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); onTogglePin({ id: session.id, is_pinned: !session.is_pinned }); }}
                >
                  {session.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {session.is_pinned && (
                <Pin className="h-3 w-3 text-primary shrink-0" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
