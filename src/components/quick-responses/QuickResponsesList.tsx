import { useState } from "react";
import { QuickResponse } from "@/hooks/useQuickResponses";
import { QuickResponseCard } from "./QuickResponseCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MessageSquare, Search } from "lucide-react";

interface QuickResponsesListProps {
  responses: QuickResponse[];
  categories: string[];
  selectedCategory: string | null;
  onCreate: (data: { title: string; message: string; category: string }) => void;
  onUpdate: (id: string, data: { title?: string; message?: string }) => void;
  onDelete: (id: string) => void;
}

export function QuickResponsesList({
  responses,
  categories,
  selectedCategory,
  onCreate,
  onUpdate,
  onDelete,
}: QuickResponsesListProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState(selectedCategory || "Geral");

  const filteredResponses = responses.filter((r) => {
    const matchesCategory = !selectedCategory || r.category === selectedCategory;
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.message.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreate = () => {
    if (newTitle.trim() && newMessage.trim()) {
      onCreate({
        title: newTitle.trim(),
        message: newMessage.trim(),
        category: newCategory || "Geral",
      });
      setNewTitle("");
      setNewMessage("");
      setNewCategory(selectedCategory || "Geral");
      setCreateOpen(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            {selectedCategory || "Todas as Respostas"}
          </h1>
          <span className="text-sm text-muted-foreground">
            {filteredResponses.length} {filteredResponses.length === 1 ? "resposta" : "respostas"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Resposta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Resposta Rápida</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Saudação inicial"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <SelectItem value="Geral">Geral</SelectItem>
                      ) : (
                        categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))
                      )}
                      <SelectItem value="Geral">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite a mensagem que deseja copiar rapidamente..."
                    rows={6}
                    className="resize-none"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || !newMessage.trim()}
                >
                  Criar Resposta
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {filteredResponses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Nenhuma resposta</h2>
            <p className="text-muted-foreground max-w-sm mb-4">
              {search
                ? "Nenhuma resposta encontrada para sua busca."
                : "Crie sua primeira resposta rápida para copiar mensagens facilmente."}
            </p>
            {!search && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Resposta
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredResponses.map((response) => (
              <QuickResponseCard
                key={response.id}
                response={response}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
