import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Menu, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTransactions } from "@/hooks/useTransactions";
import { useUnviewedTransactions } from "@/hooks/useUnviewedTransactions";
import { useAbandonedEvents } from "@/hooks/useAbandonedEvents";
import { useUnviewedAbandonedEvents } from "@/hooks/useUnviewedAbandonedEvents";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";

interface AppLayoutProps {
  children: React.ReactNode;
}

const pageConfig: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Visão geral do seu negócio" },
  "/transacoes": { title: "Transações", subtitle: "Gerencie todas as transações" },
  "/recuperacao": { title: "Recuperação", subtitle: "Recupere vendas perdidas" },
  "/projetos": { title: "Quadros", subtitle: "Organize suas tarefas" },
  "/typebots": { title: "Typebots", subtitle: "Análise de performance" },
  "/gerar-boleto": { title: "Gerar Boleto", subtitle: "Crie novos boletos" },
  "/configuracoes": { title: "Configurações", subtitle: "Ajustes do sistema" },
};

export function AppLayout({ children }: AppLayoutProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const location = useLocation();
  const { transactions } = useTransactions();
  const unviewedCount = useUnviewedTransactions(transactions);
  const { events: abandonedEvents } = useAbandonedEvents();
  const unviewedAbandonedCount = useUnviewedAbandonedEvents(abandonedEvents);
  const { extensionStatus, retryConnection } = useWhatsAppExtension();

  // Fetch Evolution API settings
  const { data: evolutionSettings } = useQuery({
    queryKey: ["evolution-settings-header"],
    queryFn: async () => {
      const { data } = await supabase
        .from("evolution_api_settings")
        .select("instance_name, is_active, server_url")
        .maybeSingle();
      return data;
    },
    staleTime: 30000,
  });
  
  const totalNotifications = unviewedCount + unviewedAbandonedCount;

  const currentPage = pageConfig[location.pathname] || { title: "Página", subtitle: "" };

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
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <AppSidebar isAdmin={isAdmin} userId={userId} unviewedTransactions={unviewedCount} />
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-14 lg:h-16 border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile Menu */}
          <div className="lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[240px] border-r border-border">
                <AppSidebar isAdmin={isAdmin} userId={userId} unviewedTransactions={unviewedCount} isMobile={true} />
              </SheetContent>
            </Sheet>
          </div>

          {/* Page Title - Desktop */}
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-foreground">{currentPage.title}</h1>
            <p className="text-xs text-muted-foreground">{currentPage.subtitle}</p>
          </div>

          {/* Mobile Title */}
          <div className="lg:hidden flex items-center gap-2">
            <img src="/logo-ov.png" alt="Origem Viva" className="h-7 w-7" />
            <span className="font-semibold text-sm">{currentPage.title}</span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Evolution API Status - Desktop Only */}
            {evolutionSettings?.instance_name && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                        evolutionSettings.is_active
                          ? "bg-success/10 text-success border border-success/30"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      <Smartphone className="h-3 w-3" />
                      <span className="hidden xl:inline max-w-[100px] truncate">
                        {evolutionSettings.instance_name}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Evolution API: {evolutionSettings.instance_name}
                      {evolutionSettings.is_active ? " (Ativo)" : " (Inativo)"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* WhatsApp Extension Status - Desktop Only */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={retryConnection}
                    className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      extensionStatus === "connected"
                        ? "bg-success/10 text-success border border-success/30"
                        : extensionStatus === "connecting"
                        ? "bg-warning/10 text-warning border border-warning/30"
                        : "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
                    }`}
                  >
                    {extensionStatus === "connecting" ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className={`h-2 w-2 rounded-full ${
                        extensionStatus === "connected" ? "bg-success" : "bg-destructive"
                      }`} />
                    )}
                    <span className="hidden xl:inline">
                      {extensionStatus === "connected"
                        ? "Extensão"
                        : extensionStatus === "connecting"
                        ? "Conectando..."
                        : "Desconectado"}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {extensionStatus === "connected"
                      ? "Extensão WhatsApp conectada"
                      : extensionStatus === "connecting"
                      ? "Tentando conectar..."
                      : "Clique para tentar reconectar"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* New Transaction Alert Indicator */}
            {totalNotifications > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/30 rounded-full animate-pulse">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span className="text-xs font-medium text-success">
                  {totalNotifications} nova{totalNotifications > 1 ? 's' : ''}
                </span>
              </div>
            )}
            
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/50">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary uppercase">
                  {userName.charAt(0)}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-medium text-foreground capitalize">{userName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {isAdmin ? "Administrador" : "Colaborador"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-grid-pattern">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
