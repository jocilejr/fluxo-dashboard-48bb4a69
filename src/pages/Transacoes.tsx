import { useState, useEffect } from "react";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import { useTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultDateFilter } from "@/components/dashboard/DateFilter";

const Transacoes = () => {
  const defaultFilter = getDefaultDateFilter();
  const { transactions, isLoading, refetch } = useTransactions({
    startDate: defaultFilter.startDate,
    endDate: defaultFilter.endDate,
  });
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

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <TransactionsTable 
        transactions={transactions} 
        isLoading={isLoading} 
        onDelete={refetch}
        isAdmin={isRealAdmin === true}
      />
    </div>
  );
};

export default Transacoes;
