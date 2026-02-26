export function PageTransition() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="relative flex items-center justify-center">
        {/* Outer ring */}
        <div className="absolute h-16 w-16 rounded-full border border-border/40 animate-[spin_3s_linear_infinite]">
          <div className="absolute -top-[3px] -left-[3px] h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
        </div>

        {/* Middle ring - counter rotation */}
        <div className="absolute h-10 w-10 rounded-full border border-border/20 animate-[spin_2s_linear_infinite_reverse]">
          <div className="absolute -bottom-[2px] -right-[2px] h-1.5 w-1.5 rounded-full bg-primary/70 shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
        </div>

        {/* Center pulse */}
        <div className="h-2 w-2 rounded-full bg-primary/80 animate-pulse shadow-[0_0_12px_hsl(var(--primary)/0.5)]" />
      </div>
    </div>
  );
}
