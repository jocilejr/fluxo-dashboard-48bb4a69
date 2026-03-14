import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { toast } from "sonner";
import { Crown, Plus, Search, Settings, Gift, Users, BookOpen, Check, ShoppingBag, Edit, Brain, Loader2, Activity } from "lucide-react";
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
import MemberActivityTab from "@/components/membros/MemberActivityTab";

// ---- Member Products Tab ----
function MemberProductsTab() {
  const queryClient = useQueryClient();
  const [searchPhone, setSearchPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["delivery-products-names"],
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
    // Group by last 8 digits to unify same person
    const map = new Map<string, { phone: string; items: any[] }>();
    for (const mp of memberProducts) {
      const last8 = mp.normalized_phone.slice(-8);
      if (!map.has(last8)) map.set(last8, { phone: mp.normalized_phone, items: [] });
      map.get(last8)!.items.push(mp);
    }
    return Array.from(map.values()).map(({ phone, items }) => ({ phone, products: items }));
  }, [memberProducts]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const digits = newPhone.replace(/\D/g, "");
      if (!digits || !newProductId) throw new Error("Preencha todos os campos");
      
      // Check if access already exists by last 8 digits
      const last8 = digits.slice(-8);
      const { data: existing } = await supabase
        .from("member_products")
        .select("id, normalized_phone")
        .eq("product_id", newProductId);
      
      const match = existing?.find(mp => mp.normalized_phone.slice(-8) === last8);
      if (match) {
        // Reactivate if inactive
        await supabase.from("member_products").update({ is_active: true, granted_at: new Date().toISOString() }).eq("id", match.id);
        toast.info("Este cliente já possui acesso a este produto.");
        return;
      }
      
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
  const [greetingPrompt, setGreetingPrompt] = useState("");
  const [offerPrompt, setOfferPrompt] = useState("");

  useState(() => {
    if (settings) {
      setTitle(settings.title || "Área de Membros");
      setLogoUrl(settings.logo_url || "");
      setWelcomeMessage(settings.welcome_message || "");
      setThemeColor(settings.theme_color || "#8B5CF6");
      setAiPersonaPrompt((settings as any).ai_persona_prompt || "");
      setGreetingPrompt((settings as any).greeting_prompt || "");
      setOfferPrompt((settings as any).offer_prompt || "");
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title, logo_url: logoUrl || null, welcome_message: welcomeMessage, theme_color: themeColor, ai_persona_prompt: aiPersonaPrompt || null, greeting_prompt: greetingPrompt || null, offer_prompt: offerPrompt || null } as any;
      if (settings?.id) {
        const { error } = await supabase.from("member_area_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_area_settings").insert(payload);
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
            placeholder="Você é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Fala com carinho, como uma amiga próxima. Nunca usa termos de marketing."
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">Define como a IA se comporta no chat e nas ofertas</p>
        </div>

        <div className="border-t border-border pt-4 mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Prompts de IA</h3>
        </div>

        <div>
          <Label>Prompt da Saudação Inicial</Label>
          <Textarea
            value={greetingPrompt}
            onChange={(e) => setGreetingPrompt(e.target.value)}
            placeholder={`Você é um assistente espiritual carinhoso. Gere UMA frase curta (máximo 2 linhas) e personalizada para o membro da área de membros.\nA frase deve:\n- Ser motivacional e acolhedora\n- Mencionar pelo menos um dos produtos/materiais disponíveis\n- Incentivar o membro a explorar conteúdos que ainda não viu\n- Ter um tom religioso sutil e positivo\n- Usar emojis com moderação (1-2 no máximo)\n- NUNCA ultrapassar 150 caracteres\nResponda APENAS com a frase, sem aspas, sem prefixo.`}
            rows={8}
          />
          <p className="text-xs text-muted-foreground mt-1">Prompt usado para gerar a mensagem de boas-vindas personalizada ao membro. Deixe vazio para usar o padrão.</p>
        </div>

        <div>
          <Label>Prompt da Copy de Oferta</Label>
          <Textarea
            value={offerPrompt}
            onChange={(e) => setOfferPrompt(e.target.value)}
            placeholder={`Você vai gerar mensagens de chat simulando uma conversa pessoal sobre um material que a pessoa demonstrou interesse.\n\nREGRAS ABSOLUTAS:\n- NUNCA use termos de marketing como "insights", "mindset", "jornada transformadora"\n- Fale de forma natural, como uma amiga\n- Gere EXATAMENTE 3 mensagens (balão 1, balão 2 e balão 4)\n- Cada mensagem deve ter no máximo 2-3 frases curtas`}
            rows={10}
          />
          <p className="text-xs text-muted-foreground mt-1">Prompt usado para gerar as mensagens de venda no chat de ofertas. Deixe vazio para usar o padrão. Variáveis disponíveis: {`{firstName}, {ownedNames}, {offerName}, {offerDescription}, {offerPrice}, {memberDays}, {profileCategory}`}</p>
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
  const [categoryTag, setCategoryTag] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [displayType, setDisplayType] = useState("card");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("telefone");
  const [cardPaymentUrl, setCardPaymentUrl] = useState("");
  const [extractingKnowledge, setExtractingKnowledge] = useState<string | null>(null);

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

  // Count unique clickers who then purchased the offer's product
  const { data: offerConversions } = useQuery({
    queryKey: ["offer-conversions"],
    queryFn: async () => {
      if (!offers?.length) return {};
      const productOffers = offers.filter((o: any) => o.product_id);
      if (!productOffers.length) return {};
      const productIds = productOffers.map((o: any) => o.product_id);
      const { data: members } = await supabase
        .from("member_products")
        .select("product_id, normalized_phone")
        .in("product_id", productIds)
        .eq("is_active", true);
      const conversionMap: Record<string, number> = {};
      productOffers.forEach((o: any) => {
        conversionMap[o.id] = (members || []).filter((m: any) => m.product_id === o.product_id).length;
      });
      return conversionMap;
    },
    enabled: !!offers?.length,
  });

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `offers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("member-files").upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("member-files").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const resetForm = () => {
    setSelectedProductId(""); setDescription(""); setPurchaseUrl(""); setPrice(""); setCategoryTag(""); setImageFile(null); setEditingOffer(null); setUploading(false); setDisplayType("card"); setPixKey(""); setPixKeyType("telefone"); setCardPaymentUrl("");
  };

  const openEdit = (offer: any) => {
    setEditingOffer(offer);
    setSelectedProductId(offer.product_id || "");
    setDescription(offer.description || "");
    setPurchaseUrl(offer.purchase_url || "");
    setPrice(offer.price ? String(offer.price) : "");
    setCategoryTag(offer.category_tag || "");
    setDisplayType(offer.display_type || "card");
    setPixKey(offer.pix_key || "");
    setPixKeyType(offer.pix_key_type || "telefone");
    setCardPaymentUrl(offer.card_payment_url || "");
    setImageFile(null);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingOffer && !selectedProductId) throw new Error("Selecione um produto");
      setUploading(true);
      const product = products?.find(p => p.id === selectedProductId);
      let imageUrl: string | null = editingOffer?.image_url || null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      } else if (!editingOffer && product?.page_logo) {
        imageUrl = product.page_logo;
      }

      if (editingOffer) {
        const { error } = await supabase.from("member_area_offers").update({
          description: description || null,
          image_url: imageUrl,
          purchase_url: purchaseUrl || "",
          price: price ? parseFloat(price) : null,
          category_tag: categoryTag || null,
          display_type: displayType,
          pix_key: pixKey || null,
          pix_key_type: pixKeyType || "telefone",
          card_payment_url: cardPaymentUrl || null,
        } as any).eq("id", editingOffer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_area_offers").insert({
          name: product?.name || "Oferta",
          product_id: selectedProductId,
          description: description || null,
          image_url: imageUrl,
          purchase_url: purchaseUrl || "",
          price: price ? parseFloat(price) : (product?.value || null),
          category_tag: categoryTag || null,
          display_type: displayType,
          pix_key: pixKey || null,
          pix_key_type: pixKeyType || "telefone",
          card_payment_url: cardPaymentUrl || null,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingOffer ? "Oferta atualizada!" : "Oferta adicionada!");
      queryClient.invalidateQueries({ queryKey: ["member-area-offers"] });
      resetForm(); setDialogOpen(false);
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

  const handleExtractKnowledge = async (productId: string) => {
    if (!productId) { toast.error("Esta oferta não tem produto vinculado"); return; }
    setExtractingKnowledge(productId);
    try {
      const { data, error } = await supabase.functions.invoke("member-extract-knowledge", {
        body: { product_id: productId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Resumo gerado! ${(data?.key_topics || []).length} tópicos extraídos`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar resumo");
    }
    setExtractingKnowledge(null);
  };

  const selectedProduct = products?.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Oferta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingOffer ? "Editar Oferta" : "Nova Oferta (baseada em produto)"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {!editingOffer && (
                <div>
                  <Label>Produto</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                    <SelectContent>{products?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              )}
              {(selectedProduct || editingOffer) && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  {(selectedProduct?.page_logo || editingOffer?.image_url) && <img src={editingOffer?.image_url || selectedProduct?.page_logo} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                  <div>
                    <p className="font-medium text-sm">{editingOffer?.name || selectedProduct?.name}</p>
                    {(selectedProduct?.value || editingOffer?.price) && <p className="text-xs text-muted-foreground">R$ {Number(editingOffer?.price || selectedProduct?.value).toFixed(2).replace(".", ",")}</p>}
                  </div>
                </div>
              )}
              <div><Label>Descrição (opcional)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Por que esse produto é especial..." /></div>
              <div>
                <Label>Imagem {editingOffer ? "(envie para substituir)" : "(opcional — usa logo do produto se vazio)"}</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground mt-1">Tamanho recomendado: 600×200px (formato banner horizontal)</p>
              </div>
              <div><Label>Tag de categoria (opcional)</Label><Input value={categoryTag} onChange={(e) => setCategoryTag(e.target.value)} placeholder="Ex: Material complementar" /></div>
              <div>
                <Label>Tipo de exibição</Label>
                <Select value={displayType} onValueChange={setDisplayType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Oferta Card</SelectItem>
                    
                    <SelectItem value="showcase">Produto Físico (Vitrine)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo da chave PIX</Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Chave PIX</Label><Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Digite a chave PIX" /></div>
              <div><Label>Link do checkout (cartão de crédito)</Label><Input value={cardPaymentUrl} onChange={(e) => setCardPaymentUrl(e.target.value)} placeholder="https://checkout.exemplo.com/..." /></div>
              <div><Label>Preço (R$) {editingOffer ? "" : "— usa o valor do produto se vazio"}</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={selectedProduct?.value ? String(selectedProduct.value) : "0.00"} /></div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading || (!editingOffer && !selectedProductId)}>
                {saveMutation.isPending || uploading ? "Salvando..." : editingOffer ? "Salvar Alterações" : "Adicionar Oferta"}
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
          {offers.map((offer: any) => {
            const impressions = (offer as any).total_impressions || 0;
            const clicks = (offer as any).total_clicks || 0;
            const conversions = offerConversions?.[offer.id] || 0;
            const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0";
            return (
              <Card key={offer.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {offer.image_url && <img src={offer.image_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{offer.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        {offer.price && <span>R$ {Number(offer.price).toFixed(2).replace(".", ",")}</span>}
                        {offer.delivery_products?.name && <Badge variant="secondary" className="text-[10px]">{offer.delivery_products.name}</Badge>}
                        <Badge variant="outline" className="text-[10px]">{(offer as any).display_type === "showcase" ? "Produto Físico" : "Card"}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span title="Impressões">{impressions.toLocaleString("pt-BR")} views</span>
                        <span title="Cliques">{clicks.toLocaleString("pt-BR")} cliques</span>
                        <span title="Taxa de clique (CTR)">{ctr}% CTR</span>
                        <span title="Conversões" className="text-emerald-600 font-medium">{conversions} vendas</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {offer.product_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerar resumo de conhecimento (IA)"
                        disabled={extractingKnowledge === offer.product_id}
                        onClick={() => handleExtractKnowledge(offer.product_id)}
                      >
                        {extractingKnowledge === offer.product_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                      </Button>
                    )}
                    <Switch checked={offer.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: offer.id, active: checked })} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(offer)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(offer.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
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
          <TabsTrigger value="activity" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Activity className="h-4 w-4" /> Atividade
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Settings className="h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products"><MemberProductsTab /></TabsContent>
        <TabsContent value="content"><ContentManagement /></TabsContent>
        <TabsContent value="offers"><MemberOffersTab /></TabsContent>
        <TabsContent value="activity"><MemberActivityTab /></TabsContent>
        <TabsContent value="settings"><MemberSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
