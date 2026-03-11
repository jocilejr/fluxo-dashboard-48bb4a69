import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GripVertical, Sparkles, Star, BookOpen, Cross, Gift, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LayoutSection = "greeting" | "products_interleaved" | "ai_tip" | "verse" | "offers";

const sectionMeta: Record<LayoutSection, { label: string; description: string; icon: typeof Sparkles }> = {
  greeting: { label: "Mensagem I.A.", description: "Saudação personalizada gerada por inteligência artificial", icon: Sparkles },
  products_interleaved: { label: "Produtos + Sugestão IA", description: "Produtos liberados com sugestão estratégica entre eles", icon: Star },
  ai_tip: { label: "Dica da IA", description: "Dica personalizada gerada por inteligência artificial", icon: Lightbulb },
  verse: { label: "Salmo / Versículo", description: "Versículo do dia exibido entre os conteúdos", icon: Cross },
  offers: { label: "Ofertas Exclusivas", description: "Cards de produtos bloqueados para upsell", icon: Gift },
};

const DEFAULT_ORDER: LayoutSection[] = ["greeting", "products_interleaved", "ai_tip", "verse", "offers"];

// Old sections that should be migrated
const OLD_SECTIONS = ["recent_product", "other_products", "content"];

export default function LayoutEditor() {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<LayoutSection[]>(DEFAULT_ORDER);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["member-area-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("member_area_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings && (settings as any).layout_order) {
      try {
        const raw = (settings as any).layout_order as string[];
        if (Array.isArray(raw) && raw.length > 0) {
          const hasOld = raw.some(s => OLD_SECTIONS.includes(s));
          if (hasOld) {
            // Auto-migrate: use default order
            setOrder(DEFAULT_ORDER);
            return;
          }
          const validKeys = Object.keys(sectionMeta) as LayoutSection[];
          const filtered = raw.filter((s): s is LayoutSection => validKeys.includes(s as LayoutSection));
          const missing = DEFAULT_ORDER.filter(k => !filtered.includes(k));
          setOrder([...filtered, ...missing]);
        }
      } catch {}
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("Configurações não encontradas");
      const { error } = await supabase.from("member_area_settings").update({ layout_order: order as any }).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Layout salvo!"); queryClient.invalidateQueries({ queryKey: ["member-area-settings"] }); },
    onError: () => toast.error("Erro ao salvar layout"),
  });

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const newOrder = [...order];
    const [item] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, item);
    setOrder(newOrder);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      moveItem(dragIdx, idx);
      setDragIdx(idx);
    }
  };
  const handleDragEnd = () => setDragIdx(null);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h4 className="font-bold text-foreground text-sm">Ordem dos elementos na página</h4>
          <p className="text-xs text-muted-foreground mt-1">Arraste para reorganizar a ordem de exibição na área de membros pública</p>
        </div>

        <div className="space-y-2">
          {order.map((section, idx) => {
            const meta = sectionMeta[section];
            const IconComp = meta.icon;
            return (
              <div
                key={section}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all cursor-grab active:cursor-grabbing ${
                  dragIdx === idx
                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconComp className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{idx + 1}</span>
              </div>
            );
          })}
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? "Salvando..." : "Salvar Layout"}
        </Button>
      </CardContent>
    </Card>
  );
}
