import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface GlobalPixel {
  id: string;
  platform: string;
  pixel_id: string;
  access_token: string | null;
  event_name: string | null;
  is_active: boolean;
}

const PLATFORMS = [
  { value: "meta", label: "Meta (Facebook)" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google Ads" },
  { value: "pinterest", label: "Pinterest" },
  { value: "taboola", label: "Taboola" },
];

const GlobalPixelsConfig = () => {
  const queryClient = useQueryClient();
  const [newPixel, setNewPixel] = useState({
    platform: "",
    pixel_id: "",
    access_token: "",
    event_name: "Purchase",
  });

  const { data: pixels, isLoading } = useQuery({
    queryKey: ["global-pixels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_delivery_pixels")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GlobalPixel[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("global_delivery_pixels").insert({
        platform: newPixel.platform,
        pixel_id: newPixel.pixel_id,
        access_token: newPixel.access_token || null,
        event_name: newPixel.event_name || "Purchase",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-pixels"] });
      setNewPixel({ platform: "", pixel_id: "", access_token: "", event_name: "Purchase" });
      toast.success("Pixel adicionado!");
    },
    onError: () => {
      toast.error("Erro ao adicionar pixel");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("global_delivery_pixels")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-pixels"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("global_delivery_pixels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-pixels"] });
      toast.success("Pixel removido!");
    },
  });

  const handleAdd = () => {
    if (!newPixel.platform || !newPixel.pixel_id) {
      toast.error("Preencha a plataforma e o ID do pixel");
      return;
    }
    addMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar Novo Pixel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                value={newPixel.platform}
                onValueChange={(value) => setNewPixel((prev) => ({ ...prev, platform: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ID do Pixel</Label>
              <Input
                value={newPixel.pixel_id}
                onChange={(e) => setNewPixel((prev) => ({ ...prev, pixel_id: e.target.value }))}
                placeholder="123456789"
              />
            </div>

            <div className="space-y-2">
              <Label>Access Token (opcional)</Label>
              <Input
                value={newPixel.access_token}
                onChange={(e) => setNewPixel((prev) => ({ ...prev, access_token: e.target.value }))}
                placeholder="Para API de Conversões"
              />
            </div>

            <div className="space-y-2">
              <Label>Nome do Evento</Label>
              <Input
                value={newPixel.event_name}
                onChange={(e) => setNewPixel((prev) => ({ ...prev, event_name: e.target.value }))}
                placeholder="Purchase"
              />
            </div>
          </div>

          <Button onClick={handleAdd} disabled={addMutation.isPending} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Pixel
          </Button>
        </CardContent>
      </Card>

      {pixels && pixels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pixels Configurados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pixels.map((pixel) => (
                <div
                  key={pixel.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={pixel.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: pixel.id, is_active: checked })
                      }
                    />
                    <div>
                      <p className="font-medium capitalize">{pixel.platform}</p>
                      <p className="text-sm text-muted-foreground">
                        {pixel.pixel_id} • {pixel.event_name}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(pixel.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!pixels || pixels.length === 0) && (
        <p className="text-center text-muted-foreground py-4">
          Nenhum pixel configurado. Adicione um pixel acima.
        </p>
      )}
    </div>
  );
};

export default GlobalPixelsConfig;