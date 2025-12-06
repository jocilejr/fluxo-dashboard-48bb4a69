import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import PixelConfig from "./PixelConfig";

interface DeliveryProduct {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  whatsapp_message: string | null;
  delivery_webhook_url: string | null;
  page_title: string;
  page_message: string;
  page_logo: string | null;
  redirect_delay: number;
  is_active: boolean;
  value: number;
}

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  product: DeliveryProduct | null;
}

const ProductForm = ({ open, onClose, product }: ProductFormProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!product;

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    whatsapp_number: "",
    whatsapp_message: "",
    delivery_webhook_url: "",
    page_title: "Preparando sua entrega...",
    page_message: "Você será redirecionado em instantes",
    page_logo: "",
    redirect_delay: 3,
    is_active: true,
    value: 0,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        slug: product.slug,
        whatsapp_number: product.whatsapp_number,
        whatsapp_message: product.whatsapp_message || "",
        delivery_webhook_url: product.delivery_webhook_url || "",
        page_title: product.page_title,
        page_message: product.page_message,
        page_logo: product.page_logo || "",
        redirect_delay: product.redirect_delay,
        is_active: product.is_active,
        value: product.value || 0,
      });
    } else {
      setFormData({
        name: "",
        slug: "",
        whatsapp_number: "",
        whatsapp_message: "",
        delivery_webhook_url: "",
        page_title: "Preparando sua entrega...",
        page_message: "Você será redirecionado em instantes",
        page_logo: "",
        redirect_delay: 3,
        is_active: true,
        value: 0,
      });
    }
  }, [product, open]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        whatsapp_message: formData.whatsapp_message || null,
        delivery_webhook_url: formData.delivery_webhook_url || null,
        page_logo: formData.page_logo || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("delivery_products")
          .update(payload)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-products"] });
      toast.success(isEditing ? "Produto atualizado!" : "Produto criado!");
      onClose();
    },
    onError: (error: any) => {
      if (error?.message?.includes("unique")) {
        toast.error("Já existe um produto com esse slug");
      } else {
        toast.error("Erro ao salvar produto");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="pixels">Pixels</TabsTrigger>
              <TabsTrigger value="page">Página</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Produto *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Manuscrito do Arcanjo Miguel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL) *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/e/</span>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))
                      }
                      placeholder="manuscrito-do-arcanjo-miguel"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Valor do Produto (R$)</Label>
                  <Input
                    id="value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        value: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="97.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este valor será enviado no disparo do pixel
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem WhatsApp (opcional)</Label>
                  <Textarea
                    id="message"
                    value={formData.whatsapp_message}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, whatsapp_message: e.target.value }))
                    }
                    placeholder="Olá! Vim receber meu produto..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Será enviada para o número do lead (via URL)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook">Webhook de Entrega (opcional)</Label>
                  <Input
                    id="webhook"
                    value={formData.delivery_webhook_url}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, delivery_webhook_url: e.target.value }))
                    }
                    placeholder="https://seu-sistema.com/webhook"
                  />
                  <p className="text-xs text-muted-foreground">
                    Será enviado: {"{ telefone, produto, produto_slug }"}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="active">Produto Ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Links inativos não funcionarão
                    </p>
                  </div>
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pixels" className="mt-4">
              {isEditing ? (
                <PixelConfig productId={product.id} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Salve o produto primeiro para configurar os pixels.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="page" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="logo">URL do Logo (opcional)</Label>
                <Input
                  id="logo"
                  value={formData.page_logo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, page_logo: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título da Página</Label>
                <Input
                  id="title"
                  value={formData.page_title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, page_title: e.target.value }))
                  }
                  placeholder="Preparando sua entrega..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pageMessage">Mensagem da Página</Label>
                <Textarea
                  id="pageMessage"
                  value={formData.page_message}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, page_message: e.target.value }))
                  }
                  placeholder="Você será redirecionado em instantes"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay">Delay de Redirecionamento (segundos)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={1}
                  max={10}
                  value={formData.redirect_delay}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      redirect_delay: parseInt(e.target.value) || 3,
                    }))
                  }
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Produto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
