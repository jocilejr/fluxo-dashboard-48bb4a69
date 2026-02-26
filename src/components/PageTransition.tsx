export function PageTransition() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
