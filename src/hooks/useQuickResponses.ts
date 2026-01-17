import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface QuickResponse {
  id: string;
  user_id: string;
  category: string;
  title: string;
  message: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useQuickResponses() {
  const queryClient = useQueryClient();

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["quick-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_responses")
        .select("*")
        .order("category")
        .order("sort_order");

      if (error) throw error;
      return data as QuickResponse[];
    },
  });

  const categories = [...new Set(responses.map((r) => r.category))];

  const createResponse = useMutation({
    mutationFn: async (input: { title: string; message: string; category: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("quick_responses")
        .insert({
          title: input.title,
          message: input.message,
          category: input.category,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-responses"] });
      toast.success("Resposta rápida criada!");
    },
    onError: (error) => {
      toast.error("Erro ao criar resposta: " + error.message);
    },
  });

  const updateResponse = useMutation({
    mutationFn: async (input: { id: string; title?: string; message?: string; category?: string }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("quick_responses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-responses"] });
      toast.success("Resposta atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const deleteResponse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quick_responses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-responses"] });
      toast.success("Resposta excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const renameCategory = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const responsesToUpdate = responses.filter((r) => r.category === oldName);
      
      for (const response of responsesToUpdate) {
        const { error } = await supabase
          .from("quick_responses")
          .update({ category: newName })
          .eq("id", response.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-responses"] });
      toast.success("Categoria renomeada!");
    },
    onError: (error) => {
      toast.error("Erro ao renomear categoria: " + error.message);
    },
  });

  return {
    responses,
    categories,
    isLoading,
    createResponse,
    updateResponse,
    deleteResponse,
    renameCategory,
  };
}
