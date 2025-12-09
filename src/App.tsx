import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ResponsiveLayout } from "./components/ResponsiveLayout";
import { MobileLayout } from "./components/mobile/MobileLayout";
import { MobileProfile } from "./components/mobile/MobileProfile";
import Dashboard from "./pages/Dashboard";
import Transacoes from "./pages/Transacoes";
import Recuperacao from "./pages/Recuperacao";
import Projetos from "./pages/Projetos";
import TypebotRanking from "./pages/TypebotRanking";
import GerarBoleto from "./pages/GerarBoleto";
import Configuracoes from "./pages/Configuracoes";
import Entrega from "./pages/Entrega";
import EntregaPublica from "./pages/EntregaPublica";
import LinksUteis from "./pages/LinksUteis";
import Clientes from "./pages/Clientes";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { addActivityLog } from "./components/settings/ActivityLogs";

const queryClient = new QueryClient();

// Log app initialization
const logAppStart = () => {
  addActivityLog({
    type: "info",
    category: "Sistema",
    message: "Dashboard iniciado",
    details: `Versão: ${new Date().toISOString()}`
  });
};

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
          {/* Rota pública para página de entrega - sem autenticação */}
          <Route path="/e/:slug" element={<EntregaPublica />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
