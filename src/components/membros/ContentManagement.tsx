import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, FolderPlus, FileText, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function ContentManagement() {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["delivery-products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products").select("id, name").eq("is_active", true);
      return data || [];
    },
  });

  if (!selectedProductId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Selecione um produto para gerenciar o conteúdo:</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products?.map((p) => (
            <Card
              key={p.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-primary"
              onClick={() => setSelectedProductId(p.id)}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="font-medium">{p.name}</span>
              </div>
            </Card>
          ))}
        </div>
        {!products?.length && (
          <p className="text-center py-8 text-muted-foreground">Nenhum produto ativo encontrado</p>
        )}
      </div>
    );
  }

  const product = products?.find((p) => p.id === selectedProductId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedProductId(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h3 className="font-semibold">{product?.name}</h3>
      </div>
      <ProductContentEditor productId={selectedProductId} />
    </div>
  );
}

function ProductContentEditor({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [matDialogOpen, setMatDialogOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("📖");
  const [catDesc, setCatDesc] = useState("");
  const [matTitle, setMatTitle] = useState("");
  const [matDesc, setMatDesc] = useState("");
  const [matType, setMatType] = useState("text");
  const [matUrl, setMatUrl] = useState("");
  const [matText, setMatText] = useState("");
  const [matCategoryId, setMatCategoryId] = useState<string>("");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_product_categories")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: materials } = useQuery({
    queryKey: ["admin-materials", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_product_materials")
        .select("*, member_product_categories(name)")
        .eq("product_id", productId)
        .order("sort_order");
      return data || [];
    },
  });

  const addCatMutation = useMutation({
    mutationFn: async () => {
      if (!catName) throw new Error("Nome é obrigatório");
      const { error } = await supabase.from("member_product_categories").insert({
        product_id: productId,
        name: catName,
        icon: catIcon || "📖",
        description: catDesc || null,
        sort_order: (categories?.length || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria criada!");
      queryClient.invalidateQueries({ queryKey: ["admin-categories", productId] });
      setCatName(""); setCatIcon("📖"); setCatDesc(""); setCatDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_product_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria removida");
      queryClient.invalidateQueries({ queryKey: ["admin-categories", productId] });
      queryClient.invalidateQueries({ queryKey: ["admin-materials", productId] });
    },
  });

  const addMatMutation = useMutation({
    mutationFn: async () => {
      if (!matTitle) throw new Error("Título é obrigatório");
      const { error } = await supabase.from("member_product_materials").insert({
        product_id: productId,
        category_id: matCategoryId || null,
        title: matTitle,
        description: matDesc || null,
        content_type: matType,
        content_url: matUrl || null,
        content_text: matText || null,
        sort_order: (materials?.length || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material adicionado!");
      queryClient.invalidateQueries({ queryKey: ["admin-materials", productId] });
      setMatTitle(""); setMatDesc(""); setMatType("text"); setMatUrl(""); setMatText(""); setMatCategoryId(""); setMatDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMatMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_product_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material removido");
      queryClient.invalidateQueries({ queryKey: ["admin-materials", productId] });
    },
  });

  const contentTypes = [
    { value: "text", label: "Texto/Oração" },
    { value: "pdf", label: "PDF" },
    { value: "video", label: "Vídeo" },
    { value: "audio", label: "Áudio" },
    { value: "image", label: "Imagem" },
    { value: "link", label: "Link externo" },
  ];

  return (
    <div className="space-y-6">
      {/* Categories Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium flex items-center gap-2">
            <FolderPlus className="h-4 w-4" /> Categorias / Módulos
          </h4>
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ex: Orações da Manhã" /></div>
                <div><Label>Ícone (emoji)</Label><Input value={catIcon} onChange={(e) => setCatIcon(e.target.value)} className="w-20" /></div>
                <div><Label>Descrição (opcional)</Label><Input value={catDesc} onChange={(e) => setCatDesc(e.target.value)} /></div>
                <Button className="w-full" onClick={() => addCatMutation.mutate()} disabled={addCatMutation.isPending}>Criar Categoria</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!categories?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria. Materiais ficarão sem agrupamento.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat: any) => (
              <Badge key={cat.id} variant="secondary" className="gap-1 py-1 px-3">
                {cat.icon} {cat.name}
                <button onClick={() => deleteCatMutation.mutate(cat.id)} className="ml-1 text-destructive hover:text-destructive/80">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Materials Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Materiais
          </h4>
          <Dialog open={matDialogOpen} onOpenChange={setMatDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Novo Material</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo Material</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={matTitle} onChange={(e) => setMatTitle(e.target.value)} placeholder="Ex: Oração da Manhã" /></div>
                <div><Label>Descrição (opcional)</Label><Input value={matDesc} onChange={(e) => setMatDesc(e.target.value)} /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={matCategoryId} onValueChange={setMatCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem categoria</SelectItem>
                      {categories?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de conteúdo</Label>
                  <Select value={matType} onValueChange={setMatType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {contentTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {matType === "text" ? (
                  <div><Label>Conteúdo de texto</Label><Textarea value={matText} onChange={(e) => setMatText(e.target.value)} placeholder="Digite o conteúdo aqui..." rows={8} /></div>
                ) : (
                  <div><Label>URL do conteúdo</Label><Input value={matUrl} onChange={(e) => setMatUrl(e.target.value)} placeholder="https://..." /></div>
                )}
                <Button className="w-full" onClick={() => addMatMutation.mutate()} disabled={addMatMutation.isPending}>Adicionar Material</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!materials?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum material cadastrado</p>
        ) : (
          <div className="space-y-2">
            {materials.map((mat: any) => (
              <Card key={mat.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">{mat.content_type}</Badge>
                      <span className="font-medium text-sm truncate">{mat.title}</span>
                    </div>
                    {mat.member_product_categories?.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">📁 {mat.member_product_categories.name}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteMatMutation.mutate(mat.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
