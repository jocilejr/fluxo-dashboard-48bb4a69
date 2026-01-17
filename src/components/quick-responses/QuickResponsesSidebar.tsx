import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare, Folder } from "lucide-react";

interface QuickResponsesSidebarProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onCreateCategory: (name: string) => void;
}

export function QuickResponsesSidebar({
  categories,
  selectedCategory,
  onSelectCategory,
  onCreateCategory,
}: QuickResponsesSidebarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateCategory(newName.trim());
      setNewName("");
      setCreateOpen(false);
    }
  };

  return (
    <div className="w-64 border-r flex flex-col bg-card/50 border-border/30 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-sm">Categorias</h2>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome da categoria</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Atendimento"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={!newName.trim()}>
                Criar Categoria
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* All responses */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1",
              selectedCategory === null
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/50"
            )}
            onClick={() => onSelectCategory(null)}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="text-sm truncate flex-1">Todas</span>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-6">
              <Folder className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma categoria</p>
              <Button variant="link" size="sm" onClick={() => setCreateOpen(true)}>
                Criar primeira categoria
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map((category) => (
                <div
                  key={category}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => onSelectCategory(category)}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="text-sm truncate flex-1">{category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
