import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeader } from "./MobileHeader";
import { useTransactions } from "@/hooks/useTransactions";
import { useUnviewedTransactions } from "@/hooks/useUnviewedTransactions";
import { useAbandonedEvents } from "@/hooks/useAbandonedEvents";
import { useUnviewedAbandonedEvents } from "@/hooks/useUnviewedAbandonedEvents";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const pageConfig: Record<string, string> = {
  "/": "Dashboard",
  "/transacoes": "Transações",
  "/clientes": "Clientes",
  "/perfil": "Perfil",
};

export function MobileLayout({ children }: MobileLayoutProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const location = useLocation();
  
  const { transactions } = useTransactions();
  const unviewedCount = useUnviewedTransactions(transactions);
  const { events: abandonedEvents } = useAbandonedEvents();
  const unviewedAbandonedCount = useUnviewedAbandonedEvents(abandonedEvents);
  
  const totalNotifications = unviewedCount + unviewedAbandonedCount;
  const title = pageConfig[location.pathname] || "App";

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      if (user) {
        setUserName(user.email?.split("@")[0] || "Usuário");
        
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        setIsAdmin(data?.role === "admin");
      }
    };
    getUser();
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] flex flex-col mobile-theme">
      <MobileHeader 
        title={title}
        userName={userName}
        isAdmin={isAdmin}
        notificationCount={totalNotifications}
      />
      
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>
      
      <MobileBottomNav unviewedCount={totalNotifications} />
    </div>
  );
}