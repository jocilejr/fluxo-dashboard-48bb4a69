import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ResponsiveLayout } from "./components/ResponsiveLayout";
import { MobileLayout } from "./components/mobile/MobileLayout";
import { MobileProfile } from "./components/mobile/MobileProfile";
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
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Entrega = lazy(() => import("./pages/Entrega"));
const EntregaPublica = lazy(() => import("./pages/EntregaPublica"));
const LinksUteis = lazy(() => import("./pages/LinksUteis"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Grupos = lazy(() => import("./pages/Grupos"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      refetchOnWindowFocus: false,
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
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ResponsiveLayout mobileComponent="dashboard">
                  <Dashboard />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transacoes"
            element={
              <ProtectedRoute>
                <ResponsiveLayout mobileComponent="transactions">
                  <Transacoes />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <MobileLayout>
                  <MobileProfile />
                </MobileLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recuperacao"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <Recuperacao />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projetos"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <Projetos />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/typebots"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <TypebotRanking />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gerar-boleto"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <GerarBoleto />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <Configuracoes />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/entrega"
            element={
              <ProtectedRoute>
                <ResponsiveLayout mobileComponent="entrega">
                  <Entrega />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/links-uteis"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <LinksUteis />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes"
            element={
              <ProtectedRoute>
                <ResponsiveLayout mobileComponent="clientes">
                  <Clientes />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/grupos"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <Grupos />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          {/* Rota pública para página de entrega - sem autenticação */}
          <Route path="/e/:slug" element={<EntregaPublica />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
