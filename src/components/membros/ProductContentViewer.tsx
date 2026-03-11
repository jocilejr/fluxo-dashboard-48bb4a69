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
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: themeColor }} />
      </div>
    );
  }

  const allMaterials = materials || [];
  const allCategories = categories || [];

  if (allMaterials.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-gray-400">Conteúdo em breve...</p>
      </div>
    );
  }

  const categorized = allCategories
    .map((cat: any) => ({
      ...cat,
      materials: allMaterials.filter((m: any) => m.category_id === cat.id),
    }))
    .filter((cat: any) => cat.materials.length > 0);

  const uncategorized = allMaterials.filter((m: any) => !m.category_id);

  return (
    <div className="space-y-8">
      {categorized.map((cat: any) => (
        <div key={cat.id}>
          {/* Category separator */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-base"
              style={{ backgroundColor: `${themeColor}10` }}
            >
              {cat.icon || "📖"}
            </div>
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{cat.name}</h4>
            <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
            <span className="text-xs text-gray-400 font-medium">{cat.materials.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cat.materials.map((mat: any) => (
              <MaterialCard key={mat.id} material={mat} themeColor={themeColor} />
            ))}
          </div>
        </div>
      ))}

      {uncategorized.length > 0 && (
        <div>
          {categorized.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-base"
                style={{ backgroundColor: `${themeColor}10` }}
              >
                📂
              </div>
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Outros</h4>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
              <span className="text-xs text-gray-400 font-medium">{uncategorized.length}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {uncategorized.map((mat: any) => (
              <MaterialCard key={mat.id} material={mat} themeColor={themeColor} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
