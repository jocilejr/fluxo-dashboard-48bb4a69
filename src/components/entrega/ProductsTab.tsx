import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Link as LinkIcon, Trash2, ExternalLink } from "lucide-react";
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

  const handleEdit = (product: DeliveryProduct) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Produtos</h2>
          <p className="text-sm text-muted-foreground">
            {products?.length || 0} produto(s) cadastrado(s)
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Produto
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products?.map((product) => (
            <Card key={product.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-medium truncate pr-2">
                    {product.name}
                  </CardTitle>
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Slug</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                    /e/{product.slug}
                  </code>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <p className="text-sm font-mono">{product.whatsapp_number}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => setLinkProduct(product)}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Gerar Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteProduct(product)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
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
