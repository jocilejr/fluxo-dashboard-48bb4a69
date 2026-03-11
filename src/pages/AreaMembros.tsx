import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { toast } from "sonner";
import { Crown, Plus, Search, Settings, Gift, Users } from "lucide-react";
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

  // Get unique phones and fetch customer names
  const uniquePhones = useMemo(() => {
    if (!memberProducts) return [];
    const phones = new Set(memberProducts.map((mp: any) => mp.normalized_phone));
    return Array.from(phones);
  }, [memberProducts]);

  const { data: customers } = useQuery({
    queryKey: ["member-customers", uniquePhones],
    queryFn: async () => {
      if (!uniquePhones.length) return [];
      // Generate all variations for all phones
      const allVariations = uniquePhones.flatMap((p) => generatePhoneVariations(p));
      const unique = [...new Set(allVariations)];
      const { data } = await supabase
        .from("customers")
        .select("normalized_phone, name")
        .in("normalized_phone", unique);
      return data || [];
    },
    enabled: uniquePhones.length > 0,
  });

  // Map phone -> customer name
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

  // Group member_products by phone
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
      const { error } = await supabase.from("member_products").insert({
        normalized_phone: digits,
        product_id: newProductId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto liberado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["member-products"] });
      queryClient.invalidateQueries({ queryKey: ["member-customers"] });
      setNewPhone("");
      setNewProductId("");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso removido");
      queryClient.invalidateQueries({ queryKey: ["member-products"] });
    },
  });

  const handleAddForPhone = (phone: string) => {
    setNewPhone(phone);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por telefone..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Liberar Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Liberar Produto para Membro</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Telefone do cliente</Label>
                <Input
                  placeholder="Ex: 89981340810"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div>
                <Label>Produto</Label>
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? "Liberando..." : "Liberar Acesso"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
            <MemberClientCard
              key={phone}
              phone={phone}
              products={prods}
              customerName={phoneToName[phone] || null}
              onDeleteProduct={(id) => deleteMutation.mutate(id)}
              onAddProduct={handleAddForPhone}
            />
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
    queryFn: async () => {
      const { data } = await supabase.from("member_area_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [themeColor, setThemeColor] = useState("#8B5CF6");

  // Sync state when settings load
  useState(() => {
    if (settings) {
      setTitle(settings.title || "Área de Membros");
      setLogoUrl(settings.logo_url || "");
      setWelcomeMessage(settings.welcome_message || "");
      setThemeColor(settings.theme_color || "#8B5CF6");
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings?.id) {
        const { error } = await supabase
          .from("member_area_settings")
          .update({ title, logo_url: logoUrl || null, welcome_message: welcomeMessage, theme_color: themeColor })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("member_area_settings")
          .insert({ title, logo_url: logoUrl || null, welcome_message: welcomeMessage, theme_color: themeColor });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas!");
      queryClient.invalidateQueries({ queryKey: ["member-area-settings"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label>Título da Área</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Área de Membros" />
        </div>
        <div>
          <Label>URL do Logo</Label>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <Label>Mensagem de boas-vindas</Label>
          <Textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Bem-vinda à sua área exclusiva!"
          />
        </div>
        <div>
          <Label>Cor do tema</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="h-10 w-14 rounded border cursor-pointer"
            />
            <Input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-32" />
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- Offers Tab ----
function MemberOffersTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [price, setPrice] = useState("");

  const { data: offers, isLoading } = useQuery({
    queryKey: ["member-area-offers"],
    queryFn: async () => {
      const { data } = await supabase.from("member_area_offers").select("*").order("sort_order");
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!name || !purchaseUrl) throw new Error("Nome e URL de compra são obrigatórios");
      const { error } = await supabase.from("member_area_offers").insert({
        name,
        description: description || null,
        image_url: imageUrl || null,
        purchase_url: purchaseUrl,
        price: price ? parseFloat(price) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oferta adicionada!");
      queryClient.invalidateQueries({ queryKey: ["member-area-offers"] });
      setName("");
      setDescription("");
      setImageUrl("");
      setPurchaseUrl("");
      setPrice("");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_area_offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oferta removida");
      queryClient.invalidateQueries({ queryKey: ["member-area-offers"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("member_area_offers").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["member-area-offers"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Nova Oferta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Oferta Exclusiva</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da oferta" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição..." />
              </div>
              <div>
                <Label>URL da Imagem</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label>URL de Compra</Label>
                <Input value={purchaseUrl} onChange={(e) => setPurchaseUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
              </div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adicionando..." : "Adicionar Oferta"}
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
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{offer.name}</p>
                  {offer.price && (
                    <p className="text-sm text-muted-foreground">
                      R$ {Number(offer.price).toFixed(2).replace(".", ",")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={offer.is_active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: offer.id, active: checked })}
                  />
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(offer.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
export default function AreaMembros() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Área de Membros</h1>
          <p className="text-sm text-muted-foreground">Gerencie os produtos e ofertas da sua área de membros</p>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="gap-2">
            <Users className="h-4 w-4" /> Membros
          </TabsTrigger>
          <TabsTrigger value="offers" className="gap-2">
            <Gift className="h-4 w-4" /> Ofertas
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" /> Aparência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <MemberProductsTab />
        </TabsContent>
        <TabsContent value="offers">
          <MemberOffersTab />
        </TabsContent>
        <TabsContent value="settings">
          <MemberSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
