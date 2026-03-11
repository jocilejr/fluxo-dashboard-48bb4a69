import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import MaterialCard from "./MaterialCard";

interface Props {
  productId: string;
  productName: string;
  themeColor: string;
}

export default function ProductContentViewer({ productId, productName, themeColor }: Props) {
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
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: themeColor }} />
      </div>
    );
  }

  const allMaterials = materials || [];
  const allCategories = categories || [];

  if (allMaterials.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Conteúdo em breve...</p>;
  }

  // Group materials by category
  const categorized = allCategories
    .map((cat: any) => ({
      ...cat,
      materials: allMaterials.filter((m: any) => m.category_id === cat.id),
    }))
    .filter((cat: any) => cat.materials.length > 0);

  const uncategorized = allMaterials.filter((m: any) => !m.category_id);

  return (
    <div className="space-y-5">
      {/* Categorized materials as flat sections */}
      {categorized.map((cat: any) => (
        <div key={cat.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{cat.icon || "📖"}</span>
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{cat.name}</h4>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cat.materials.map((mat: any) => (
              <MaterialCard key={mat.id} material={mat} themeColor={themeColor} />
            ))}
          </div>
        </div>
      ))}

      {/* Uncategorized materials */}
      {uncategorized.length > 0 && (
        <div>
          {categorized.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📂</span>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Outros</h4>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {uncategorized.map((mat: any) => (
              <MaterialCard key={mat.id} material={mat} themeColor={themeColor} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
