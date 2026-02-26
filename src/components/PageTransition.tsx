import { Skeleton } from "@/components/ui/skeleton";

export function PageTransition() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="w-full max-w-md space-y-4 px-6">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-3 w-3/4 rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-4/5 rounded-full" />
      </div>
    </div>
  );
}
