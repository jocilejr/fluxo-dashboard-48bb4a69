import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BrowserToolbarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onReload: () => void;
  loading: boolean;
}

export function BrowserToolbar({ currentUrl, onNavigate, onReload, loading }: BrowserToolbarProps) {
  const [inputUrl, setInputUrl] = useState(currentUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = inputUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    onNavigate(url);
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-border bg-card">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => window.history.forward()}>
        <ArrowRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onReload} disabled={loading}>
        <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
      <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Digite a URL..."
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Button type="submit" size="sm" className="h-8" disabled={loading}>
          Ir
        </Button>
      </form>
    </div>
  );
}
