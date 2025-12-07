import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface MobileHeaderProps {
  title: string;
  userName: string;
  isAdmin: boolean;
  notificationCount?: number;
}

export function MobileHeader({ title, userName, isAdmin, notificationCount = 0 }: MobileHeaderProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-40 bg-background/98 backdrop-blur-xl border-b border-border safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground uppercase">
              {userName.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">{userName}</h1>
            <p className="text-[10px] text-muted-foreground capitalize font-medium">
              {isAdmin ? "Admin" : "Colaborador"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notificationCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/15 border border-success/30 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-[11px] font-semibold text-success">
                {notificationCount}
              </span>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
