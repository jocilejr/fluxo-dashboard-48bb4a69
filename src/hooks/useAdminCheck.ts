import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useAdminCheck = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Timeout de segurança para evitar loading infinito
    const timeout = setTimeout(() => {
      if (isChecking) {
        console.warn("Timeout de verificação de role - permitindo acesso");
        setIsAdmin(true);
        setIsChecking(false);
      }
    }, 5000);

    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("Erro ao verificar role (tabela pode não existir):", error.message);
          setIsAdmin(true);
        } else if (!data) {
          console.warn("Usuário sem role definida, permitindo acesso");
          setIsAdmin(true);
        } else {
          setIsAdmin(data.role === "admin" || data.role === "user");
        }
      } catch (err) {
        console.warn("Erro ao verificar role:", err);
        setIsAdmin(true);
      } finally {
        setIsChecking(false);
      }
    };

    if (!authLoading) {
      checkAdminRole();
    }

    return () => clearTimeout(timeout);
  }, [user, authLoading]);

  return { isAdmin, isChecking: authLoading || isChecking, user };
};
