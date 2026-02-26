import { Loader2 } from "lucide-react";

export function PageTransition() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">
          Carregando...
        </p>
      </div>
    </div>
  );
}
