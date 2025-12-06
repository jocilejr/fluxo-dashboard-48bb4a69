import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ExternalLink, Plus, Trash2, GripVertical, Pencil, Loader2, Link as LinkIcon } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

const LinksUteis = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminCheck();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<UsefulLink | null>(null);
  const [form, setForm] = useState({ title: "", url: "", description: "" });

  const { data: links, isLoading } = useQuery({
    queryKey: ["useful-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("useful_links")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as UsefulLink[];
    },
  });

  const createLink = useMutation({
    mutationFn: async (data: { title: string; url: string; description: string }) => {
      const maxOrder = links?.reduce((max, l) => Math.max(max, l.sort_order), 0) || 0;
      const { error } = await supabase
        .from("useful_links")
        .insert({ ...data, sort_order: maxOrder + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
      toast.success("Link adicionado");
      resetForm();
    },
    onError: () => toast.error("Erro ao adicionar link"),
  });

  const updateLink = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title: string; url: string; description: string }) => {
      const { error } = await supabase
        .from("useful_links")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
      toast.success("Link atualizado");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar link"),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("useful_links")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
      toast.success("Link removido");
    },
    onError: () => toast.error("Erro ao remover link"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("useful_links")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
    },
  });

  const resetForm = () => {
    setForm({ title: "", url: "", description: "" });
    setEditingLink(null);
    setDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!form.title || !form.url) {
      toast.error("Preencha título e URL");
      return;
    }
    if (editingLink) {
      updateLink.mutate({ id: editingLink.id, ...form });
    } else {
      createLink.mutate(form);
    }
  };

  const openEdit = (link: UsefulLink) => {
    setEditingLink(link);
    setForm({ title: link.title, url: link.url, description: link.description || "" });
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Links Úteis</h1>
          <p className="text-sm text-muted-foreground">Acesse recursos e ferramentas importantes</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLink ? "Editar Link" : "Novo Link"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Nome do link"
                    className="bg-secondary/30 border-border/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
                    className="bg-secondary/30 border-border/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Breve descrição"
                    className="bg-secondary/30 border-border/30"
                  />
                </div>
                <Button onClick={handleSubmit} className="w-full" disabled={createLink.isPending || updateLink.isPending}>
                  {(createLink.isPending || updateLink.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingLink ? "Salvar Alterações" : "Adicionar Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(!links || links.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LinkIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum link cadastrado</p>
          {isAdmin && <p className="text-sm text-muted-foreground">Clique em "Adicionar Link" para começar</p>}
        </div>
      ) : (
        <div className="grid gap-3">
          {links.map((link) => (
            <Card
              key={link.id}
              className={`p-4 flex items-center gap-4 transition-all ${!link.is_active ? "opacity-50" : ""}`}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ExternalLink className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm hover:text-primary transition-colors truncate block"
                >
                  {link.title}
                </a>
                {link.description && (
                  <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch
                    checked={link.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: link.id, is_active: checked })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(link)} className="h-8 w-8 p-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteLink.mutate(link.id)}
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LinksUteis;
