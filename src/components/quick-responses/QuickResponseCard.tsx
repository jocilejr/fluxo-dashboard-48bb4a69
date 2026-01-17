import { useState } from "react";
import { QuickResponse } from "@/hooks/useQuickResponses";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Check, MoreVertical, Pencil, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuickResponseCardProps {
  response: QuickResponse;
  onUpdate: (id: string, data: { title?: string; message?: string }) => void;
  onDelete: (id: string) => void;
}

export function QuickResponseCard({ response, onUpdate, onDelete }: QuickResponseCardProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(response.title);
  const [editMessage, setEditMessage] = useState(response.message);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(response.message);
    setCopied(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onUpdate(response.id, { title: editTitle, message: editMessage });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(response.title);
    setEditMessage(response.message);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="border-primary/50">
        <CardContent className="p-4 space-y-3">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Título"
            className="font-medium"
          />
          <Textarea
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            placeholder="Mensagem..."
            rows={4}
            className="resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm">{response.title}</h4>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 transition-colors",
                copied && "text-green-500"
              )}
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(response.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
          {response.message}
        </p>
      </CardContent>
    </Card>
  );
}
