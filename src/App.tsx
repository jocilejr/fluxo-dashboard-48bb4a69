import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedLayout } from "./components/ProtectedLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { addActivityLog } from "./components/settings/ActivityLogs";
import { Loader2 } from "lucide-react";

// Lazy loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transacoes = lazy(() => import("./pages/Transacoes"));
const Recuperacao = lazy(() => import("./pages/Recuperacao"));
const Projetos = lazy(() => import("./pages/Projetos"));
const TypebotRanking = lazy(() => import("./pages/TypebotRanking"));
const GerarBoleto = lazy(() => import("./pages/GerarBoleto"));
const AreaMembros = lazy(() => import("./pages/AreaMembros"));
const AreaMembrosPublica = lazy(() => import("./pages/AreaMembrosPublica"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Entrega = lazy(() => import("./pages/Entrega"));
const EntregaPublica = lazy(() => import("./pages/EntregaPublica"));
const LinksUteis = lazy(() => import("./pages/LinksUteis"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Grupos = lazy(() => import("./pages/Grupos"));
const Lembretes = lazy(() => import("./pages/Lembretes"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

const logAppStart = () => {
  addActivityLog({
    type: "info",
    category: "Sistema",
    message: "Dashboard iniciado",
    details: `Versão: ${new Date().toISOString()}`
  });
};

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  useEffect(() => {
    logAppStart();
  }, []);

  return (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
          
          {/* All protected routes share the same layout (sidebar persists) */}
          <Route element={<ProtectedLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="transacoes" element={<Transacoes />} />
            <Route path="recuperacao" element={<Recuperacao />} />
            <Route path="projetos" element={<Projetos />} />
            <Route path="typebots" element={<TypebotRanking />} />
            <Route path="gerar-boleto" element={<GerarBoleto />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="entrega" element={<Entrega />} />
            <Route path="links-uteis" element={<LinksUteis />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="grupos" element={<Grupos />} />
            <Route path="area-membros" element={<AreaMembros />} />
            <Route path="perfil" element={<Dashboard />} />
          </Route>

          {/* Public routes */}
          <Route path="/membros/:phone" element={<Suspense fallback={<PageLoader />}><AreaMembrosPublica /></Suspense>} />

          {/* Public route */}
          <Route path="/e/:slug" element={<Suspense fallback={<PageLoader />}><EntregaPublica /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
