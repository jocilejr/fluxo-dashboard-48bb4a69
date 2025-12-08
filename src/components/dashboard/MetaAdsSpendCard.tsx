import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, AlertCircle, Loader2, Settings } from "lucide-react";
import { Link } from "react-router-dom";

interface MetaAdsInsights {
  configured: boolean;
  tokenExpired?: boolean;
  error?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  reach?: number;
  cpm?: number;
  cpc?: number;
  ctr?: number;
  purchases?: number;
  leads?: number;
}

interface MetaAdsSpendCardProps {
  startDate?: string;
  endDate?: string;
}

export const MetaAdsSpendCard = ({ startDate, endDate }: MetaAdsSpendCardProps) => {
  const { data, isLoading, error } = useQuery<MetaAdsInsights>({
    queryKey: ["meta-ads-insights", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-ads-insights", {
        body: { startDate, endDate },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });

  // Not configured - don't show anything
  if (!isLoading && data && !data.configured) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-card/60 border border-border/30 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Carregando Meta Ads...</span>
        </div>
      </div>
    );
  }

  // Error or token expired
  if (data?.tokenExpired || data?.error) {
    return (
      <div className="bg-card/60 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-amber-300">
              {data.tokenExpired ? "Token do Meta expirado" : "Erro ao buscar dados"}
            </span>
          </div>
          <Link 
            to="/configuracoes" 
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Settings className="h-3 w-3" />
            Configurar
          </Link>
        </div>
      </div>
    );
  }

  // Show spend data
  const spend = data?.spend || 0;

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-xs text-muted-foreground">Gasto Meta Ads</span>
        </div>
      </div>
      
      <div className="text-2xl font-bold text-foreground">
        R$ {spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </div>

      {data?.impressions && data.impressions > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <div className="font-medium text-foreground">{data.impressions.toLocaleString()}</div>
            <div className="text-muted-foreground">Impressões</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <div className="font-medium text-foreground">{data.clicks?.toLocaleString() || 0}</div>
            <div className="text-muted-foreground">Cliques</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <div className="font-medium text-foreground">{data.ctr?.toFixed(2) || 0}%</div>
            <div className="text-muted-foreground">CTR</div>
          </div>
        </div>
      )}
    </div>
  );
};
