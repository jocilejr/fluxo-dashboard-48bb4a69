import { useState, useMemo, useEffect } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { PaymentMethodsChart } from "@/components/dashboard/PaymentMethodsChart";
import { DateFilter, DateFilterValue, getDefaultDateFilter } from "@/components/dashboard/DateFilter";
import { useTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, 
  QrCode, 
  CreditCard,
  DollarSign,
  Percent,
  Wallet,
  Megaphone,
  RefreshCw,
  Eye,
  MousePointerClick,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupStatsCards } from "@/components/dashboard/GroupStatsCards";
import { GroupHistoryChart } from "@/components/dashboard/GroupHistoryChart";
import { MetaAdsSpendCard } from "@/components/dashboard/MetaAdsSpendCard";

interface MetaAdsInsights {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: string;
  cpm: string;
  cpc: string;
  reach: number;
  purchases: number;
  leads: number;
  tokenExpired?: boolean;
  error?: string;
}

const Dashboard = () => {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(getDefaultDateFilter);
  const { transactions, isLoading, refetch } = useTransactions({
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };
  const [isRealAdmin, setIsRealAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsRealAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsRealAdmin(data?.role === "admin");
    };
    checkRole();
  }, []);

  const { data: financialSettings } = useQuery({
    queryKey: ["financial-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isRealAdmin === true,
  });

  const { data: manualRevenues } = useQuery({
    queryKey: ["manual-revenues", dateFilter.startDate, dateFilter.endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_revenues")
        .select("*")
        .gte("received_at", dateFilter.startDate.toISOString())
        .lte("received_at", dateFilter.endDate.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: isRealAdmin === true,
  });

  // Convert dates to Brazil timezone string (YYYY-MM-DD) to avoid UTC conversion issues
  const formatDateToBrazil = (date: Date) => {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  };
  const startDateStr = formatDateToBrazil(dateFilter.startDate);
  const endDateStr = formatDateToBrazil(dateFilter.endDate);

  const { data: metaAdsData } = useQuery<MetaAdsInsights>({
    queryKey: ["meta-ads-insights-dashboard", startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-ads-insights", {
        body: { startDate: startDateStr, endDate: endDateStr },
      });
      if (error) throw error;
      return data;
    },
    enabled: isRealAdmin === true,
  });

  // Offer metrics
  const { data: offerMetrics } = useQuery({
    queryKey: ["offer-metrics-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_area_offers")
        .select("id, name, total_impressions, total_clicks, product_id")
        .eq("is_active", true);
      const offers = data || [];
      const totalImpressions = offers.reduce((s: number, o: any) => s + (o.total_impressions || 0), 0);
      const totalClicks = offers.reduce((s: number, o: any) => s + (o.total_clicks || 0), 0);

      // Count conversions (members who have the offer's product)
      const productIds = offers.filter((o: any) => o.product_id).map((o: any) => o.product_id);
      let totalConversions = 0;
      if (productIds.length > 0) {
        const { count } = await supabase
          .from("member_products")
          .select("id", { count: "exact", head: true })
          .in("product_id", productIds)
          .eq("is_active", true);
        totalConversions = count || 0;
      }

      return {
        totalImpressions,
        totalClicks,
        totalConversions,
        ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0",
      };
    },
    enabled: isRealAdmin === true,
  });

  // Transactions are already filtered by date range from the hook
  const filteredTransactions = transactions;

  const stats = useMemo(() => {
    const totalOrders = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const paidOrders = filteredTransactions
      .filter((t) => t.status === "pago")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const manualRevenueTotal = manualRevenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
    const totalRevenue = paidOrders + manualRevenueTotal;
    const taxRate = financialSettings?.tax_rate || 0;
    const taxAmount = totalRevenue * (taxRate / 100);
    const adsSpend = metaAdsData?.spend || 0;
    const netRevenue = totalRevenue - taxAmount - adsSpend;

    // Boletos pendentes = gerado + pago (excluindo expirado e cancelado)
    const boletosPendentesOuPagos = filteredTransactions.filter(
      (t) => t.type === "boleto" && (t.status === "gerado" || t.status === "pago")
    ).length;

    return {
      boletosGerados: filteredTransactions.filter((t) => t.type === "boleto" && t.status === "gerado").length,
      boletosPagos: filteredTransactions.filter((t) => t.type === "boleto" && t.status === "pago").length,
      boletosPendentesOuPagos,
      pixGerado: filteredTransactions.filter((t) => t.type === "pix" && t.status !== "pago").length,
      pixPago: filteredTransactions.filter((t) => t.type === "pix" && t.status === "pago").length,
      pedidosCartao: filteredTransactions.filter((t) => t.type === "cartao" && t.status !== "pago").length,
      cartaoPago: filteredTransactions.filter((t) => t.type === "cartao" && t.status === "pago").length,
      totalOrders,
      paidOrders,
      manualRevenueTotal,
      totalRevenue,
      taxRate,
      taxAmount,
      adsSpend,
      netRevenue,
    };
  }, [filteredTransactions, manualRevenues, financialSettings, metaAdsData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const calculateConversionRate = (paid: number, total: number) => {
    if (total === 0) return "0%";
    return `${((paid / total) * 100).toFixed(1)}% taxa de conversão`;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      {isRealAdmin && (
        <>
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <div className="flex items-center gap-2">
               <p className="text-muted-foreground text-sm">Filtrando por período</p>
               <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing} className="h-8 w-8">
                 <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
               </Button>
             </div>
             <DateFilter value={dateFilter} onChange={setDateFilter} />
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            <StatCard title="PIX Gerado" value={stats.pixGerado.toLocaleString('pt-BR')} subtitle="No período" icon={QrCode} variant="info" delay={0} isLoading={isLoading} />
            <StatCard title="Boleto Gerado" value={stats.boletosGerados.toLocaleString('pt-BR')} subtitle="No período" icon={FileText} variant="info" delay={50} isLoading={isLoading} />
            <StatCard title="Cartão Gerado" value={stats.pedidosCartao.toLocaleString('pt-BR')} subtitle="No período" icon={CreditCard} variant="info" delay={100} isLoading={isLoading} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            <StatCard title="PIX Pago" value={stats.pixPago.toLocaleString('pt-BR')} subtitle="No período" icon={QrCode} variant="success" delay={150} isLoading={isLoading} />
            <StatCard title="Boleto Pago" value={stats.boletosPagos.toLocaleString('pt-BR')} subtitle={calculateConversionRate(stats.boletosPagos, stats.boletosPendentesOuPagos)} icon={FileText} variant="success" delay={200} isLoading={isLoading} />
            <StatCard title="Cartão Pago" value={stats.cartaoPago.toLocaleString('pt-BR')} subtitle="No período" icon={CreditCard} variant="success" delay={250} isLoading={isLoading} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            <StatCard title="Faturamento" value={formatCurrency(stats.totalRevenue)} subtitle={stats.manualRevenueTotal > 0 ? `+${formatCurrency(stats.manualRevenueTotal)} manual` : "Pedidos pagos"} icon={DollarSign} variant="info" delay={300} isLoading={isLoading} />
            <StatCard title={`Imposto${stats.taxRate > 0 ? ` (${stats.taxRate}%)` : ''}`} value={stats.taxRate > 0 ? `-${formatCurrency(stats.taxAmount)}` : "R$ 0,00"} subtitle={stats.taxRate > 0 ? "Dedução fiscal" : "Não configurado"} icon={Percent} variant="warning" delay={350} isLoading={isLoading} />
            <StatCard title="Meta Ads" value={stats.adsSpend > 0 ? `-${formatCurrency(stats.adsSpend)}` : "R$ 0,00"} subtitle={stats.adsSpend > 0 ? "Gasto em ads" : "Não configurado"} icon={Megaphone} variant="warning" delay={375} isLoading={isLoading} />
            <StatCard title="Líquido" value={formatCurrency(stats.netRevenue)} subtitle={stats.taxRate > 0 || stats.adsSpend > 0 ? "Após deduções" : "Receita total"} icon={Wallet} variant="success" delay={400} isLoading={isLoading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            <div className="lg:col-span-2">
              <RevenueChart transactions={transactions} />
            </div>
            <div>
              <PaymentMethodsChart transactions={filteredTransactions} />
            </div>
          </div>

          <GroupStatsCards />
        </>
      )}

      <GroupHistoryChart />
    </div>
  );
};

export default Dashboard;
