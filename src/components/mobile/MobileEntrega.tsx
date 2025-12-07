import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Search, 
  Package, 
  Link as LinkIcon,
  Copy,
  Phone,
  ExternalLink,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeliveryProduct {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  whatsapp_message: string | null;
  redirect_url: string | null;
  is_active: boolean;
  value: number;
}

export function MobileEntrega() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<DeliveryProduct | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["delivery-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DeliveryProduct[];
    },
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.slug.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const generateLink = () => {
    if (!selectedProduct || !phoneInput.trim()) {
      toast.error("Digite o telefone do cliente");
      return;
    }

    const cleanPhone = phoneInput.replace(/\D/g, "");
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/e/${selectedProduct.slug}?telefone=${cleanPhone}`;
    
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success("Link copiado!");
    
    // Log the link generation
    const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    supabase.from("delivery_link_generations").insert({
      product_id: selectedProduct.id,
      phone: phoneInput,
      normalized_phone: normalizedPhone,
      payment_method: "pix",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["delivery-link-generations"] });
    });

    setTimeout(() => setCopiedLink(false), 2000);
  };

  const openWhatsApp = () => {
    if (!selectedProduct || !phoneInput.trim()) {
      toast.error("Digite o telefone do cliente");
      return;
    }

    const cleanPhone = phoneInput.replace(/\D/g, "");
    const formatted = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/e/${selectedProduct.slug}?telefone=${cleanPhone}`;
    
    const message = selectedProduct.whatsapp_message 
      ? selectedProduct.whatsapp_message.replace("{link}", link)
      : `Olá! Segue o link de acesso: ${link}`;
    
    window.open(`https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(message)}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card/50 rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-muted rounded w-32 mb-2" />
            <div className="h-4 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/30 border-border/30"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Products List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setPhoneInput("");
                  setCopiedLink(false);
                }}
                className="w-full bg-card/50 border border-border/30 rounded-xl p-4 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    product.is_active ? "bg-success/20" : "bg-muted"
                  )}>
                    <Package className={cn(
                      "h-5 w-5",
                      product.is_active ? "text-success" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <Badge 
                        variant={product.is_active ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {product.is_active ? "Ativo" : "Off"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      /e/{product.slug}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(product.value || 0)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Link Generator Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-3xl">
          {selectedProduct && (
            <div className="space-y-4">
              <SheetHeader>
                <SheetTitle className="text-left flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedProduct.name}</p>
                    <p className="text-xs text-muted-foreground font-normal">
                      {formatCurrency(selectedProduct.value || 0)}
                    </p>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Telefone do Cliente
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="11999999999"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="pl-10"
                      type="tel"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={generateLink}
                    className="gap-2"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-4 w-4 text-success" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar Link
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={openWhatsApp}
                    className="gap-2 bg-success hover:bg-success/90"
                  >
                    <ExternalLink className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </div>

                {selectedProduct.redirect_url && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Redireciona para: {selectedProduct.redirect_url}
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
