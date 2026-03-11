import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MaterialCard from "./MaterialCard";

interface Props {
  productId: string;
  productName: string;
  themeColor: string;
}

export default function ProductContentViewer({ productId, productName, themeColor }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ["member-categories", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_product_categories")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: materials, isLoading: loadingMats } = useQuery({
    queryKey: ["member-materials", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_product_materials")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      return data || [];
    },
  });

  if (loadingCats || loadingMats) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
      </div>
    );
  }

  const hasCats = categories && categories.length > 0;

  // If a category is selected, show its materials
  if (selectedCategoryId) {
    const cat = categories?.find((c: any) => c.id === selectedCategoryId);
    const catMaterials = (materials || []).filter((m: any) => m.category_id === selectedCategoryId);

    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedCategoryId(null)}
          className="text-amber-700 hover:text-amber-900"
        >
          ← Voltar para {productName}
        </Button>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{(cat as any)?.icon || "📖"}</span>
          <h3 className="font-semibold text-gray-800">{(cat as any)?.name}</h3>
        </div>

        {catMaterials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum material nesta categoria ainda</p>
        ) : (
          <div className="space-y-2">
            {catMaterials.map((mat: any) => (
              <MaterialCard key={mat.id} material={mat} themeColor={themeColor} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show categories list (or materials directly if no categories)
  if (!hasCats) {
    const allMaterials = materials || [];
    if (allMaterials.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-6">Conteúdo em breve...</p>;
    }
    return (
      <div className="space-y-2">
        {allMaterials.map((mat: any) => (
          <MaterialCard key={mat.id} material={mat} themeColor={themeColor} />
        ))}
      </div>
    );
  }

  // Also show uncategorized materials
  const uncategorized = (materials || []).filter((m: any) => !m.category_id);

  return (
    <div className="space-y-2">
      {categories!.map((cat: any) => {
        const count = (materials || []).filter((m: any) => m.category_id === cat.id).length;
        return (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-white border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all text-left group"
          >
            <span className="text-2xl">{cat.icon || "📖"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-800">{cat.name}</p>
              {cat.description && (
                <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{count} {count === 1 ? "item" : "itens"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 transition-colors" />
            </div>
          </button>
        );
      })}

      {uncategorized.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" /> Outros materiais
          </p>
          {uncategorized.map((mat: any) => (
            <MaterialCard key={mat.id} material={mat} themeColor={themeColor} />
          ))}
        </div>
      )}
    </div>
  );
}
