import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Menu, RefreshCw, Smartphone, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTransactions } from "@/hooks/useTransactions";
import { NotificationPopup } from "@/components/layout/NotificationPopup";
import { useUnviewedTransactions } from "@/hooks/useUnviewedTransactions";
import { useAbandonedEvents } from "@/hooks/useAbandonedEvents";
import { useUnviewedAbandonedEvents } from "@/hooks/useUnviewedAbandonedEvents";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
}

interface EvolutionSettings {
  instance_name: string;
  is_active: boolean;
  server_url: string;
  api_key: string;
}

function EvolutionStatusBadge({ evolutionSettings }: { evolutionSettings: EvolutionSettings }) {
  const [testing, setTesting] = useState(false);
  const [connectionState, setConnectionState] = useState<"idle" | "connected" | "disconnected">("idle");

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-test-connection", {
        body: {
          serverUrl: evolutionSettings.server_url,
          apiKey: evolutionSettings.api_key,
          instanceName: evolutionSettings.instance_name,
        },
      });

      if (error) throw error;

      if (data?.success && data?.connected) {
        setConnectionState("connected");
        toast.success("Instância conectada!");
      } else {
        setConnectionState("disconnected");
        toast.error(`Instância não conectada: ${data?.state || "desconhecido"}`);
      }
    } catch (err) {
      setConnectionState("disconnected");
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
            evolutionSettings.is_active
              ? "bg-success/10 text-success border border-success/30 hover:bg-success/20"
              : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
          }`}
        >
          <Smartphone className="h-3 w-3" />
          <span className="hidden xl:inline max-w-[100px] truncate">
            {evolutionSettings.instance_name}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Evolution API</p>
            <p className="text-xs text-muted-foreground truncate">{evolutionSettings.instance_name}</p>
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full ${evolutionSettings.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
              {evolutionSettings.is_active ? "Ativo" : "Inativo"}
            </span>
            {connectionState === "connected" && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle className="h-3 w-3" /> Online
              </span>
            )}
            {connectionState === "disconnected" && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3 w-3" /> Offline
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              "Testar Conexão"
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
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
  const { transactions, notifications, dismissAllNotifications } = useTransactions();
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
        .select("instance_name, is_active, server_url, api_key")
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
              <EvolutionStatusBadge evolutionSettings={evolutionSettings as EvolutionSettings} />
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

            {/* Transaction Notifications */}
            <NotificationPopup notifications={notifications} onDismiss={dismissAllNotifications} />
            
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
