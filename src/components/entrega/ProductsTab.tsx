import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Link as LinkIcon, Trash2, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import ProductForm from "./ProductForm";
import LinkGenerator from "./LinkGenerator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeliveryProduct {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  whatsapp_message: string | null;
  delivery_webhook_url: string | null;
  redirect_url: string | null;
  page_title: string;
  page_message: string;
  page_logo: string | null;
  redirect_delay: number;
  is_active: boolean;
  value: number;
  created_at: string;
}

const ProductsTab = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DeliveryProduct | null>(null);
  const [linkProduct, setLinkProduct] = useState<DeliveryProduct | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<DeliveryProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: products, isLoading } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-products"] });
      toast.success("Produto excluído com sucesso");
      setDeleteProduct(null);
    },
    onError: () => {
      toast.error("Erro ao excluir produto");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (product: DeliveryProduct) => {
      const newSlug = `${product.slug}-copia-${Date.now()}`;
      const { error } = await supabase.from("delivery_products").insert({
        name: `${product.name} (Cópia)`,
        slug: newSlug,
        whatsapp_number: product.whatsapp_number,
        whatsapp_message: product.whatsapp_message,
        delivery_webhook_url: product.delivery_webhook_url,
        redirect_url: product.redirect_url,
        page_title: product.page_title,
        page_message: product.page_message,
        page_logo: product.page_logo,
        redirect_delay: product.redirect_delay,
        is_active: false,
        value: product.value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-products"] });
      toast.success("Produto duplicado! Edite o slug e ative quando pronto.");
    },
    onError: () => {
      toast.error("Erro ao duplicar produto");
    },
  });

  const handleEdit = (product: DeliveryProduct) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm.trim()) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredProducts.length} de {products?.length || 0}
          </span>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      {products?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum produto cadastrado.</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Primeiro Produto
            </Button>
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">Nenhum produto encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium truncate flex-1" title={product.name}>
                  {product.name}
                </span>
                <Badge 
                  variant={product.is_active ? "default" : "secondary"} 
                  className="text-[10px] px-1.5 py-0 h-5"
                >
                  {product.is_active ? "Ativo" : "Off"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <code className="bg-muted px-1 py-0.5 rounded truncate max-w-[60%]" title={`/e/${product.slug}`}>
                  {product.slug}
                </code>
                <span className="font-medium text-foreground">{formatCurrency(product.value || 0)}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs gap-1"
                  onClick={() => setLinkProduct(product)}
                >
                  <LinkIcon className="h-3 w-3" />
                  Link
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => duplicateMutation.mutate(product)} title="Duplicar">
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(product)} title="Editar">
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteProduct(product)} title="Excluir">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Product Form Dialog */}
      <ProductForm
        open={showForm}
        onClose={handleCloseForm}
        product={editingProduct}
      />

      {/* Link Generator Dialog */}
      <LinkGenerator
        open={!!linkProduct}
        onClose={() => setLinkProduct(null)}
        product={linkProduct}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{deleteProduct?.name}"? 
              Esta ação não pode ser desfeita e todos os acessos registrados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProduct && deleteMutation.mutate(deleteProduct.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductsTab;
