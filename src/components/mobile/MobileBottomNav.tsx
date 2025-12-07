import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, List, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: List, label: "Transações", path: "/transacoes" },
  { icon: Users, label: "Clientes", path: "/clientes" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

interface MobileBottomNavProps {
  unviewedCount?: number;
}

export function MobileBottomNav({ unviewedCount = 0 }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const showBadge = item.path === "/transacoes" && unviewedCount > 0;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 relative transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <item.icon className={cn(
                  "h-6 w-6 transition-transform duration-200",
                  isActive && "scale-110"
                )} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-success text-success-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unviewedCount > 99 ? "99+" : unviewedCount}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-1 transition-all duration-200",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
