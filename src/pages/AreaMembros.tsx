import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { toast } from "sonner";
import { Crown, Plus, Search, Settings, Gift, Users, BookOpen, Layout, Eye, ExternalLink, RefreshCw } from "lucide-react";
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

  useState(() => {
    if (settings) { setTitle(settings.title || "Área de Membros"); setLogoUrl(settings.logo_url || ""); setWelcomeMessage(settings.welcome_message || ""); setThemeColor(settings.theme_color || "#8B5CF6"); }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings?.id) {
        const { error } = await supabase.from("member_area_settings").update({ title, logo_url: logoUrl || null, welcome_message: welcomeMessage, theme_color: themeColor }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_area_settings").insert({ title, logo_url: logoUrl || null, welcome_message: welcomeMessage, theme_color: themeColor });
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

// ---- Preview Tab (Static Mock) ----
function MemberPreviewTab() {
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
      const { data } = await supabase.from("member_area_offers").select("*").eq("is_active", true).order("sort_order").limit(3);
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["delivery-products-preview"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products").select("id, name, page_logo").eq("is_active", true).limit(4);
      return data || [];
    },
  });

  const themeColor = settings?.theme_color || "#8B5CF6";
  const logoUrl = settings?.logo_url || null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Pré-visualização estática com dados simulados. Alterações de conteúdo, ofertas e configurações são refletidas aqui automaticamente.</p>

      {/* Phone-sized frame */}
      <div className="flex justify-center">
        <div className="w-full max-w-[430px] rounded-2xl border border-border shadow-lg overflow-hidden bg-gray-50">
          {/* Theme bar */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}90, ${themeColor})` }} />

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-5 py-5 flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-2xl object-cover shrink-0 shadow-sm" style={{ border: `2px solid ${themeColor}20` }} />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">Olá, Maria</h1>
              <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                {settings?.welcome_message || "Bem-vinda à sua área exclusiva! 🎉"}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4 space-y-3">
            {/* Product cards */}
            {products && products.length > 0 ? (
              products.map((prod, i) => (
                <div key={prod.id} className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  {prod.page_logo ? (
                    <div className="relative shrink-0">
                      <img src={prod.page_logo} alt={prod.name} className="h-16 w-16 rounded-xl object-cover" style={{ border: `2px solid ${themeColor}20` }} />
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: "#10b981" }}>
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}08)` }}>
                      <BookOpen className="h-7 w-7" style={{ color: themeColor }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-[15px] leading-tight truncate">{prod.name}</h3>
                    {i === 0 ? (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Liberado recentemente</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-gray-500">✓ Liberado</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <>
                {[{ name: "Água que Cura", recent: true }, { name: "Guia de Orações", recent: false }].map((mock, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="h-16 w-16 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}08)` }}>
                      <BookOpen className="h-7 w-7" style={{ color: themeColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 text-[15px] leading-tight truncate">{mock.name}</h3>
                      {mock.recent ? (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Liberado recentemente</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-gray-500">✓ Liberado</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Offer cards */}
            {(offers && offers.length > 0 ? offers : [{ id: "mock", name: "Curso Completo de Meditação", image_url: null, category_tag: "Novo", purchase_url: "#" }]).map((offer: any) => (
              <div key={offer.id} className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="relative shrink-0">
                  {offer.image_url ? (
                    <img src={offer.image_url} alt={offer.name} className="h-16 w-16 rounded-xl object-cover opacity-70 grayscale-[30%]" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}12, ${themeColor}06)` }}>
                      <Gift className="h-6 w-6" style={{ color: `${themeColor}80` }} />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                    <Crown className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 text-[15px] leading-tight truncate">{offer.name}</h3>
                  {offer.category_tag && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: `${themeColor}cc` }}>
                      {offer.category_tag}
                    </span>
                  )}
                  <span className="flex items-center gap-1 mt-1 text-[11px] font-semibold" style={{ color: themeColor }}>
                    🔒 Toque para saber mais
                  </span>
                </div>
              </div>
            ))}

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
