import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, CheckCircle, XCircle } from "lucide-react";

interface DeliveryAccess {
  id: string;
  product_id: string;
  phone: string;
  accessed_at: string;
  pixel_fired: boolean;
  webhook_sent: boolean;
  created_at: string;
  delivery_products: {
    name: string;
    slug: string;
  };
}

const AccessesTab = () => {
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");

  const { data: products } = useQuery({
    queryKey: ["delivery-products-accesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_products")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: accesses, isLoading } = useQuery({
    queryKey: ["delivery-accesses", productFilter],
    queryFn: async () => {
      let query = supabase
        .from("delivery_accesses")
        .select("*, delivery_products(name, slug)")
        .order("accessed_at", { ascending: false })
        .limit(100);

      if (productFilter !== "all") {
        query = query.eq("product_id", productFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DeliveryAccess[];
    },
  });

  const filteredAccesses = accesses?.filter((access) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      access.phone.includes(query) ||
      access.delivery_products?.name.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por telefone ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {products?.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredAccesses?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum acesso registrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead className="text-center">Pixel</TableHead>
                  <TableHead className="text-center">Webhook</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccesses?.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{access.delivery_products?.name}</p>
                        <code className="text-xs text-muted-foreground">
                          /e/{access.delivery_products?.slug}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{access.phone}</TableCell>
                    <TableCell>{formatDate(access.accessed_at)}</TableCell>
                    <TableCell className="text-center">
                      {access.pixel_fired ? (
                        <CheckCircle className="h-4 w-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {access.webhook_sent ? (
                        <CheckCircle className="h-4 w-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        Mostrando {filteredAccesses?.length || 0} acessos (últimos 100)
      </div>
    </div>
  );
};

export default AccessesTab;
