import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Transaction } from "@/hooks/useTransactions";

interface BoletoRecoveryIconProps {
  transaction: Transaction;
}

export function BoletoRecoveryIcon({ transaction }: BoletoRecoveryIconProps) {
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    const fetchClickCount = async () => {
      const { count } = await supabase
        .from("boleto_recovery_contacts")
        .select("*", { count: "exact", head: true })
        .eq("transaction_id", transaction.id);
      setClickCount(count || 0);
    };
    fetchClickCount();
  }, [transaction.id]);

  return (
    <div className="relative inline-flex">
      <MessageSquare className={`h-3.5 w-3.5 ${clickCount > 0 ? "text-success" : "text-primary"}`} />
      {clickCount > 0 && (
        <Badge 
          className="absolute -top-2 -right-2 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] font-bold bg-success hover:bg-success text-success-foreground"
        >
          {clickCount}
        </Badge>
      )}
    </div>
  );
}
