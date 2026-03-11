import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { toast } from "sonner";
import { Crown, Plus, Search, Settings, Gift, Users, BookOpen, Layout, Eye, Check, ShoppingBag, RefreshCw, ExternalLink, Lock } from "lucide-react";
import meirePhoto from "@/assets/meire-rosana.png";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import MemberClientCard from "@/components/membros/MemberClientCard";
import ContentManagement from "@/components/membros/ContentManagement";
import LayoutEditor from "@/components/membros/LayoutEditor";
import ProductContentViewer from "@/components/membros/ProductContentViewer";

// ---- Member Products Tab ----
function MemberProductsTab() {
  const queryClient = useQueryClient();
  const [searchPhone, setSearchPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["delivery-products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products").select("id, name").eq("is_active", true);
      return data || [];
    },
  });

  const { data: memberProducts, isLoading } = useQuery({
    queryKey: ["member-products", searchPhone],
    queryFn: async () => {
      let query = supabase
        .from("member_products")
        .select("*, delivery_products(name)")
        .order("created_at", { ascending: false });

      if (searchPhone.trim()) {
        const digits = searchPhone.replace(/\D/g, "");
        query = query.ilike("normalized_phone", `%${digits}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const uniquePhones = useMemo(() => {
    if (!memberProducts) return [];
    const phones = new Set(memberProducts.map((mp: any) => mp.normalized_phone));
    return Array.from(phones);
  }, [memberProducts]);

  const { data: customers } = useQuery({
    queryKey: ["member-customers", uniquePhones],
    queryFn: async () => {
      if (!uniquePhones.length) return [];
      const allVariations = uniquePhones.flatMap((p) => generatePhoneVariations(p));
      const unique = [...new Set(allVariations)];
      const { data } = await supabase.from("customers").select("normalized_phone, name").in("normalized_phone", unique);
      return data || [];
    },
    enabled: uniquePhones.length > 0,
  });

  const phoneToName = useMemo(() => {
    const map: Record<string, string> = {};
    if (!customers) return map;
    for (const phone of uniquePhones) {
      const variations = new Set(generatePhoneVariations(phone));
      const customer = customers.find((c: any) => variations.has(c.normalized_phone));
      if (customer?.name) map[phone] = customer.name;
    }
    return map;
  }, [customers, uniquePhones]);

  const groupedByPhone = useMemo(() => {
    if (!memberProducts) return [];
    const map = new Map<string, any[]>();
    for (const mp of memberProducts) {
      const phone = mp.normalized_phone;
      if (!map.has(phone)) map.set(phone, []);
      map.get(phone)!.push(mp);
    }
    return Array.from(map.entries()).map(([phone, prods]) => ({ phone, products: prods }));
  }, [memberProducts]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const digits = newPhone.replace(/\D/g, "");
      if (!digits || !newProductId) throw new Error("Preencha todos os campos");
      const { error } = await supabase.from("member_products").insert({ normalized_phone: digits, product_id: newProductId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto liberado com sucesso!"); queryClient.invalidateQueries({ queryKey: ["member-products"] }); queryClient.invalidateQueries({ queryKey: ["member-customers"] }); setNewPhone(""); setNewProductId(""); setDialogOpen(false); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("member_products").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Acesso removido"); queryClient.invalidateQueries({ queryKey: ["member-products"] }); },
  });

  const handleAddForPhone = (phone: string) => { setNewPhone(phone); setDialogOpen(true); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por telefone..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Liberar Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Liberar Produto para Membro</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Telefone do cliente</Label><Input placeholder="Ex: 89981340810" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
              <div>
                <Label>Produto</Label>
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>{products?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>{addMutation.isPending ? "Liberando..." : "Liberar Acesso"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="px-4 py-3">
          <p className="text-2xl font-semibold text-primary">{groupedByPhone.length}</p>
          <p className="text-xs text-muted-foreground">Membros</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-semibold text-foreground">{memberProducts?.filter((p: any) => p.is_active).length || 0}</p>
          <p className="text-xs text-muted-foreground">Acessos Ativos</p>
        </Card>
        <Card className="px-4 py-3 hidden sm:block">
          <p className="text-2xl font-semibold text-foreground">{memberProducts?.length || 0}</p>
          <p className="text-xs text-muted-foreground">Total Liberados</p>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : !groupedByPhone.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum produto liberado ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByPhone.map(({ phone, products: prods }) => (
            <MemberClientCard key={phone} phone={phone} products={prods} customerName={phoneToName[phone] || null} onDeleteProduct={(id) => deleteMutation.mutate(id)} onAddProduct={handleAddForPhone} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Settings Tab ----
function MemberSettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["member-area-settings"],
    queryFn: async () => { const { data } = await supabase.from("member_area_settings").select("*").limit(1).maybeSingle(); return data; },
  });

  const [title, setTitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [themeColor, setThemeColor] = useState("#8B5CF6");
  const [aiPersonaPrompt, setAiPersonaPrompt] = useState("");

  useState(() => {
    if (settings) { setTitle(settings.title || "Área de Membros"); setLogoUrl(settings.logo_url || ""); setWelcomeMessage(settings.welcome_message || ""); setThemeColor(settings.theme_color || "#8B5CF6"); setAiPersonaPrompt((settings as any).ai_persona_prompt || ""); }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings?.id) {
        const { error } = await supabase.from("member_area_settings").update({ title, logo_url: logoUrl || null, welcome_message: welcomeMessage, theme_color: themeColor, ai_persona_prompt: aiPersonaPrompt || null } as any).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_area_settings").insert({ title, logo_url: logoUrl || null, welcome_message: welcomeMessage, theme_color: themeColor, ai_persona_prompt: aiPersonaPrompt || null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Configurações salvas!"); queryClient.invalidateQueries({ queryKey: ["member-area-settings"] }); },
    onError: () => toast.error("Erro ao salvar"),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div><Label>Título da Área</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Área de Membros" /></div>
        <div><Label>URL do Logo</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
        <div><Label>Mensagem de boas-vindas</Label><Textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} placeholder="Bem-vinda à sua área exclusiva!" /></div>
        <div>
          <Label>Cor do tema</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
            <Input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-32" />
          </div>
        </div>
        <div>
          <Label>Personalidade da IA (persona)</Label>
          <Textarea
            value={aiPersonaPrompt}
            onChange={(e) => setAiPersonaPrompt(e.target.value)}
            placeholder="Ex: Você é uma mulher cristã de 57 anos, líder de uma comunidade de orações..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">Define como a IA se comporta no chat e nas ofertas</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}</Button>
      </CardContent>
    </Card>
  );
}

// ---- Offers Tab ----
function MemberOffersTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [description, setDescription] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["delivery-products-for-offers"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products").select("id, name, page_logo, value").eq("is_active", true);
      return data || [];
    },
  });

  const { data: offers, isLoading } = useQuery({
    queryKey: ["member-area-offers"],
    queryFn: async () => { const { data } = await supabase.from("member_area_offers").select("*, delivery_products(name, page_logo)").order("sort_order"); return data || []; },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `offers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("member-files").upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("member-files").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) throw new Error("Selecione um produto");
      setUploading(true);
      const product = products?.find(p => p.id === selectedProductId);
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      } else if (product?.page_logo) {
        imageUrl = product.page_logo;
      }
      const { error } = await supabase.from("member_area_offers").insert({
        name: product?.name || "Oferta",
        product_id: selectedProductId,
        description: description || null,
        image_url: imageUrl,
        purchase_url: purchaseUrl || "",
        price: price ? parseFloat(price) : (product?.value || null),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oferta adicionada!");
      queryClient.invalidateQueries({ queryKey: ["member-area-offers"] });
      setSelectedProductId(""); setDescription(""); setPurchaseUrl(""); setPrice(""); setImageFile(null); setDialogOpen(false); setUploading(false);
    },
    onError: (err: Error) => { toast.error(err.message); setUploading(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("member_area_offers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Oferta removida"); queryClient.invalidateQueries({ queryKey: ["member-area-offers"] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("member_area_offers").update({ is_active: active }).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["member-area-offers"] }),
  });

  const selectedProduct = products?.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Oferta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Oferta (baseada em produto)</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Produto</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>{products?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              {selectedProduct && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  {selectedProduct.page_logo && <img src={selectedProduct.page_logo} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                  <div>
                    <p className="font-medium text-sm">{selectedProduct.name}</p>
                    {selectedProduct.value && <p className="text-xs text-muted-foreground">R$ {Number(selectedProduct.value).toFixed(2).replace(".", ",")}</p>}
                  </div>
                </div>
              )}
              <div><Label>Descrição (opcional)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Por que esse produto é especial..." /></div>
              <div>
                <Label>Imagem (opcional — usa logo do produto se vazio)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
              <div><Label>URL de Compra (opcional)</Label><Input value={purchaseUrl} onChange={(e) => setPurchaseUrl(e.target.value)} placeholder="https://..." /></div>
              <div><Label>Preço (R$) — usa o valor do produto se vazio</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={selectedProduct?.value ? String(selectedProduct.value) : "0.00"} /></div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || uploading || !selectedProductId}>
                {addMutation.isPending || uploading ? "Adicionando..." : "Adicionar Oferta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : !offers?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma oferta cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((offer: any) => (
            <Card key={offer.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {offer.image_url && <img src={offer.image_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{offer.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {offer.price && <span>R$ {Number(offer.price).toFixed(2).replace(".", ",")}</span>}
                      {offer.delivery_products?.name && <Badge variant="secondary" className="text-[10px]">{offer.delivery_products.name}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={offer.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: offer.id, active: checked })} />
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(offer.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Preview Tab (Full Replica) ----
function MemberPreviewTab() {
  const [previewPhone, setPreviewPhone] = useState("");
  const [activePhone, setActivePhone] = useState("");
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const { data: settings } = useQuery({
    queryKey: ["member-area-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("member_area_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: offers } = useQuery({
    queryKey: ["member-area-offers-preview"],
    queryFn: async () => {
      const { data } = await supabase.from("member_area_offers").select("*").eq("is_active", true).order("sort_order").limit(5);
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["delivery-products-preview"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products").select("id, name, page_logo").eq("is_active", true).limit(6);
      return data || [];
    },
  });

  // Fetch materials count per product
  const productIds = (products || []).map(p => p.id);
  const { data: materialCounts } = useQuery({
    queryKey: ["materials-count-preview", productIds],
    queryFn: async () => {
      if (!productIds.length) return {};
      const { data } = await supabase
        .from("member_product_materials")
        .select("product_id")
        .in("product_id", productIds);
      const counts: Record<string, number> = {};
      (data || []).forEach(m => {
        counts[m.product_id] = (counts[m.product_id] || 0) + 1;
      });
      return counts;
    },
    enabled: productIds.length > 0,
  });

  // Recent members for quick access
  const { data: recentMembers } = useQuery({
    queryKey: ["recent-members-preview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_products")
        .select("normalized_phone")
        .order("granted_at", { ascending: false })
        .limit(5);
      const phones = [...new Set((data || []).map(d => d.normalized_phone))];
      if (!phones.length) return [];
      const allVars = phones.flatMap(p => generatePhoneVariations(p));
      const { data: customers } = await supabase.from("customers").select("normalized_phone, name").in("normalized_phone", [...new Set(allVars)]);
      return phones.map(p => {
        const vars = new Set(generatePhoneVariations(p));
        const c = (customers || []).find(c => vars.has(c.normalized_phone));
        return { phone: p, name: c?.name || p };
      });
    },
  });

  const themeColor = settings?.theme_color || "#8B5CF6";
  const logoUrl = settings?.logo_url || null;

  // Mock progress data for preview
  const mockProgressData = [
    { pct: 65, label: "📖 Parou na pág. 12 de 30" },
    { pct: 30, label: "▶️ Assistiu 30% do vídeo" },
    { pct: 0, label: null },
    { pct: 100, label: "✅ Concluído" },
  ];

  const handleLoadPhone = () => {
    if (previewPhone.trim()) {
      setActivePhone(previewPhone.replace(/\D/g, ""));
    }
  };

  // If a phone is active, render the real public page in an iframe
  if (activePhone) {
    const previewUrl = `${window.location.origin}/membro/${activePhone}`;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setActivePhone("")}>
            ← Voltar ao preview estático
          </Button>
          <span className="text-sm text-muted-foreground">Visualizando membro: <strong>{activePhone}</strong></span>
          <Button variant="ghost" size="icon" onClick={() => setIframeKey(k => k + 1)} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => window.open(previewUrl, "_blank")} title="Abrir em nova aba">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-[430px] rounded-2xl border border-border shadow-lg overflow-hidden">
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full bg-white"
              style={{ height: "80vh" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick access to real member */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ver membro real</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Telefone do membro..."
              value={previewPhone}
              onChange={e => setPreviewPhone(e.target.value)}
              className="w-48"
              onKeyDown={e => e.key === "Enter" && handleLoadPhone()}
            />
            <Button size="sm" onClick={handleLoadPhone} disabled={!previewPhone.trim()}>Carregar</Button>
          </div>
        </div>
        {recentMembers && recentMembers.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {recentMembers.map(m => (
              <Button
                key={m.phone}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setActivePhone(m.phone)}
              >
                {m.name?.split(" ")[0] || m.phone}
              </Button>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">Preview estático com dados reais e progresso simulado. Clique nos produtos para ver os materiais.</p>

      {/* Phone-sized frame */}
      <div className="flex justify-center">
        <div className="w-full max-w-[430px] rounded-2xl border border-border shadow-lg overflow-hidden bg-gray-50">
          {/* Theme bar */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}90, ${themeColor})` }} />

          {/* Greeting */}
          <div className="px-5 pt-5">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Olá, Maria</h1>
          </div>

          {/* Content */}
          <div className="px-4 py-4 space-y-3">
            {/* Meire Rosana Chat Bubble Mock */}
            <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: `${themeColor}0d`, borderColor: `${themeColor}22` }}>
              <div className="flex items-center gap-2.5 px-4 py-3">
                <img src={meirePhoto} alt="Meire Rosana" className="h-9 w-9 rounded-full object-cover shadow-sm" style={{ border: `2px solid ${themeColor}40` }} />
                <p className="text-[13px] font-semibold text-gray-800 leading-tight">Meire Rosana</p>
              </div>
              <div className="px-4 pb-3.5 pt-0.5 space-y-1.5">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed w-fit max-w-[90%]" style={{ backgroundColor: `${themeColor}10` }}>
                  Maria, que bom te ver de volta! 😊
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed w-fit max-w-[90%]" style={{ backgroundColor: `${themeColor}10` }}>
                  📖 Você parou na página 12 de 30 do "Água que Cura". Continue de onde parou! 💪
                </div>
              </div>
            </div>

            {/* Interleaved product cards and offer cards */}
            {(() => {
              const prodList = products && products.length > 0 ? products : [
                { id: "mock1", name: "Água que Cura", page_logo: null },
                { id: "mock2", name: "Guia de Orações", page_logo: null },
              ];
              const offerList = offers && offers.length > 0 ? offers : [{ id: "mock", name: "Curso Completo de Meditação", image_url: null, purchase_url: "#" }];

              const interleaved: { type: "product" | "offer"; data: any; idx: number }[] = [];
              if (prodList.length > 0) interleaved.push({ type: "product", data: prodList[0], idx: 0 });
              if (offerList.length > 0) interleaved.push({ type: "offer", data: offerList[0], idx: 0 });
              for (let i = 1; i < prodList.length; i++) interleaved.push({ type: "product", data: prodList[i], idx: i });
              for (let i = 1; i < offerList.length; i++) interleaved.push({ type: "offer", data: offerList[i], idx: i });

              return interleaved.map((item) => {
                if (item.type === "product") {
                  const prod = item.data;
                  const i = item.idx;
                  const mock = mockProgressData[i % mockProgressData.length];
                  const totalMats = (materialCounts && materialCounts[prod.id]) || (i === 0 ? 5 : 3);
                  const accessed = Math.round((mock.pct / 100) * totalMats);

                  return (
                    <button
                      key={prod.id}
                      className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all duration-300 text-left active:scale-[0.98]"
                      style={{ borderColor: `${themeColor}15` }}
                      onClick={() => setOpenProductId(prod.id)}
                    >
                      {prod.page_logo ? (
                        <div className="relative shrink-0">
                          <img src={prod.page_logo} alt={prod.name} className="h-16 w-16 rounded-xl object-cover" style={{ border: `2px solid ${themeColor}20` }} />
                          {mock.pct > 0 && mock.pct < 100 && (
                            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center shadow-sm text-[9px] font-bold text-white" style={{ backgroundColor: themeColor }}>
                              {mock.pct}%
                            </div>
                          )}
                          {mock.pct === 0 && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: "#10b981" }}>
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}08)` }}>
                          <ShoppingBag className="h-7 w-7" style={{ color: themeColor }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-gray-800 text-[15px] leading-tight truncate">{prod.name}</h3>
                        {i === 0 ? (
                          <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Liberado recentemente</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-gray-500">✓ Liberado</span>
                        )}
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${mock.pct}%`, backgroundColor: themeColor }} />
                            </div>
                            <span className="text-[10px] font-semibold text-gray-400 shrink-0">{accessed}/{totalMats}</span>
                          </div>
                          {mock.label && <p className="text-[11px] text-gray-500 leading-tight truncate">{mock.label}</p>}
                        </div>
                      </div>
                    </button>
                  );
                } else {
                  const offer = item.data;
                  return (
                    <div key={offer.id} className="flex items-center gap-4 bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: `${themeColor}15` }}>
                      <div className="relative shrink-0">
                        {offer.image_url ? (
                          <img src={offer.image_url} alt={offer.name} className="h-16 w-16 rounded-xl object-cover opacity-80 grayscale-[20%]" style={{ border: `2px solid ${themeColor}20` }} />
                        ) : (
                          <div className="h-16 w-16 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}12, ${themeColor}06)` }}>
                            <Lock className="h-6 w-6" style={{ color: `${themeColor}80` }} />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: themeColor }}>
                          <Lock className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-gray-800 text-[15px] leading-tight truncate">{offer.name}</h3>
                        <span className="flex items-center gap-1 mt-1.5 text-[12px] font-semibold" style={{ color: themeColor }}>
                          🔒 Toque para saber mais
                        </span>
                      </div>
                    </div>
                  );
                }
              });
            })()}

            {/* Daily verse mock */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <div className="relative">
                <span className="absolute -top-1 -left-1 text-gray-100 text-3xl font-serif select-none">"</span>
                <p className="text-sm text-gray-700 leading-relaxed font-medium pl-4" style={{ fontFamily: "'Georgia', serif" }}>
                  O Senhor é o meu pastor, nada me faltará.
                </p>
                <p className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase mt-2 pl-4">Salmos 23:1</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-4 border-t border-gray-100 bg-white">
            <p className="text-[11px] text-gray-400">Área exclusiva para membros ✝️</p>
          </div>
        </div>
      </div>

      {/* Product content popup — real data */}
      {openProductId && (
        <Dialog open={!!openProductId} onOpenChange={(open) => !open && setOpenProductId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-white">
            {(() => {
              const prod = (products || []).find(p => p.id === openProductId);
              if (!prod) return <div className="p-8 text-center text-gray-400">Produto não encontrado</div>;
              // ProductContentViewer already imported at top
              return (
                <>
                  <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3">
                    {prod.page_logo && (
                      <img src={prod.page_logo} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    )}
                    <h2 className="font-bold text-gray-800 text-lg truncate">{prod.name}</h2>
                  </div>
                  <div className="p-5">
                    <ProductContentViewer
                      productId={prod.id}
                      productName={prod.name}
                      themeColor={themeColor}
                    />
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
// ---- Main Page ----
export default function AreaMembros() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 md:px-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Área de Membros</h1>
          <p className="text-sm text-muted-foreground">Gerencie produtos, conteúdos e ofertas exclusivas</p>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-lg flex-wrap">
          <TabsTrigger value="products" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Users className="h-4 w-4" /> Membros
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <BookOpen className="h-4 w-4" /> Conteúdo
          </TabsTrigger>
          <TabsTrigger value="offers" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Gift className="h-4 w-4" /> Ofertas
          </TabsTrigger>
          <TabsTrigger value="layout" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Layout className="h-4 w-4" /> Layout
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Settings className="h-4 w-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Eye className="h-4 w-4" /> Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products"><MemberProductsTab /></TabsContent>
        <TabsContent value="content"><ContentManagement /></TabsContent>
        <TabsContent value="offers"><MemberOffersTab /></TabsContent>
        <TabsContent value="layout"><LayoutEditor /></TabsContent>
        <TabsContent value="settings"><MemberSettingsTab /></TabsContent>
        <TabsContent value="preview"><MemberPreviewTab /></TabsContent>
      </Tabs>
    </div>
  );
}
