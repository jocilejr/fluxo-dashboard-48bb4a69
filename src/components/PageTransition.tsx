export function PageTransition() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="flex gap-1">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms] [animation-duration:0.6s]" />
        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms] [animation-duration:0.6s]" />
        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms] [animation-duration:0.6s]" />
      </div>
    </div>
  );
}
