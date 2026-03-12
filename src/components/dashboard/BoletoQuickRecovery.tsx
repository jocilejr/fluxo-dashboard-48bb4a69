import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Transaction } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Copy, 
  Check, 
  FileText, 
  Image as ImageIcon,
  User,
  Phone,
  Barcode,
  Download,
  Loader2,
  ExternalLink,
  DollarSign,
  Calendar,
  MessageCircle,
  Wifi,
  WifiOff,
  GripVertical,
  Pencil,
  X
} from "lucide-react";
import { toast } from "sonner";
import { pdfToImage } from "@/lib/pdfToImage";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { getGreeting } from "@/lib/greeting";
import { Badge } from "@/components/ui/badge";
import { addActivityLog } from "@/components/settings/ActivityLogs";

interface BoletoQuickRecoveryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onTransactionUpdate?: () => void;
}

interface RecoveryBlock {
  id: string;
  type: "text" | "pdf" | "image";
  content: string;
  order: number;
}

interface RecoveryTemplate {
  id: string;
  name: string;
  blocks: RecoveryBlock[];
  is_default: boolean;
}

export function BoletoQuickRecovery({ open, onOpenChange, transaction, onTransactionUpdate }: BoletoQuickRecoveryProps) {
  const [template, setTemplate] = useState<RecoveryTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingPhoneValue, setEditingPhoneValue] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const { extensionAvailable, extensionStatus, openChat, sendText, sendImage, retryConnection } = useWhatsAppExtension();

  useEffect(() => {
    if (open && transaction) {
      fetchDefaultTemplate();
      loadPdf();
      fetchClickCount();
      setEditingPhoneValue(transaction.customer_phone || "");
      setIsEditingPhone(false);
    } else if (!open) {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl);
      setPdfBlobUrl(null);
      setImageBlobUrl(null);
      setPdfArrayBuffer(null);
      setClickCount(0);
      setIsEditingPhone(false);
    }
  }, [open, transaction]);

  const fetchClickCount = async () => {
    if (!transaction) return;
    const { count } = await supabase
      .from("boleto_recovery_contacts")
      .select("*", { count: "exact", head: true })
      .eq("transaction_id", transaction.id);
    setClickCount(count || 0);
  };

  const registerClick = async () => {
    if (!transaction) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    
    await supabase.from("boleto_recovery_contacts").insert({
      transaction_id: transaction.id,
      user_id: userData.user.id,
      contact_method: "whatsapp",
    });
    setClickCount((prev) => prev + 1);
    
    // Invalidate the count query so BoletoRecoveryIcon updates immediately
    queryClient.invalidateQueries({ queryKey: ["boleto-recovery-count", transaction.id] });
  };

  const queryClient = useQueryClient();

  const handleSavePhone = async () => {
    if (!transaction) return;
    setIsSavingPhone(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ customer_phone: editingPhoneValue })
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success("Telefone atualizado");
      addActivityLog({ type: "action", category: "Transações", message: `Telefone atualizado: ${editingPhoneValue}`, details: `Transaction ID: ${transaction.id}` });
      setIsEditingPhone(false);
      
      // Invalidate all queries for real-time update
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-events"] }),
      ]);
      
      onTransactionUpdate?.();
    } catch (error: any) {
      toast.error("Erro ao atualizar telefone");
      addActivityLog({ type: "error", category: "Transações", message: "Erro ao atualizar telefone", details: error.message });
      console.error(error);
    } finally {
      setIsSavingPhone(false);
    }
  };

  const fetchDefaultTemplate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("boleto_recovery_templates")
        .select("*")
        .eq("is_default", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTemplate({
          id: data.id,
          name: data.name,
          is_default: data.is_default,
          blocks: Array.isArray(data.blocks) ? (data.blocks as unknown as RecoveryBlock[]) : [],
        });
      } else {
        const { data: anyTemplate } = await supabase
          .from("boleto_recovery_templates")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (anyTemplate) {
          setTemplate({
            id: anyTemplate.id,
            name: anyTemplate.name,
            is_default: anyTemplate.is_default,
            blocks: Array.isArray(anyTemplate.blocks) ? (anyTemplate.blocks as unknown as RecoveryBlock[]) : [],
          });
        }
      }
    } catch (error) {
      console.error("Error fetching template:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPdf = async () => {
    const metadata = transaction?.metadata as Record<string, unknown> | null;
    const boletoUrl = metadata?.boleto_url as string | undefined;

    if (!boletoUrl) return;

    setIsLoadingPdf(true);
    try {
      const { data: proxyData, error } = await supabase.functions.invoke("pdf-proxy", {
        body: { url: boletoUrl },
      });

      if (error) throw error;
      if (!proxyData?.data) throw new Error("No PDF data received");

      const binaryString = atob(proxyData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(pdfUrl);
      setPdfBlob(blob);
      setPdfArrayBuffer(bytes.buffer);
      
      // Generate image from PDF
      generateImageFromPdf(bytes.buffer);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Erro ao carregar boleto");
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const generateImageFromPdf = async (arrayBuffer: ArrayBuffer) => {
    setIsLoadingImage(true);
    try {
      const blob = await pdfToImage(arrayBuffer, 2);
      const imageUrl = URL.createObjectURL(blob);
      setImageBlobUrl(imageUrl);
      setImageBlob(blob);
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Erro ao gerar imagem do boleto");
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, type: "pdf" | "image") => {
    const blob = type === "pdf" ? pdfBlob : imageBlob;
    if (!blob) return;

    const fileName = `boleto-${transaction?.customer_name || "cliente"}.${type === "pdf" ? "pdf" : "jpg"}`;
    const file = new File([blob], fileName, { type: blob.type });
    
    e.dataTransfer.setData("application/octet-stream", fileName);
    e.dataTransfer.items.add(file);
    e.dataTransfer.effectAllowed = "copy";
    setIsDragging(type);
  };

  const handleDragEnd = () => {
    setIsDragging(null);
  };

  const handleDownloadImage = () => {
    if (imageBlobUrl) {
      const a = document.createElement("a");
      a.href = imageBlobUrl;
      a.download = `boleto-${transaction?.customer_name || "cliente"}.jpg`;
      a.click();
    }
  };

  const handleCopyImage = async () => {
    if (!imageBlobUrl) return;
    
    try {
      const response = await fetch(imageBlobUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      setCopiedId("image-copy");
      toast.success("Imagem copiada!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Error copying image:", error);
      toast.error("Erro ao copiar imagem");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  const replaceVariables = (text: string): string => {
    if (!transaction) return text;

    const metadata = transaction.metadata as Record<string, unknown> | null;
    const dueDate = metadata?.due_date
      ? formatDate(String(metadata.due_date))
      : "-";

    const fullName = transaction.customer_name || "Cliente";
    const firstName = fullName.split(" ")[0];

    return text
      .replace(/{saudação}/g, getGreeting())
      .replace(/{saudacao}/g, getGreeting())
      .replace(/{nome}/g, fullName)
      .replace(/{primeiro_nome}/g, firstName)
      .replace(/{valor}/g, formatCurrency(Number(transaction.amount)))
      .replace(/{vencimento}/g, dueDate)
      .replace(/{codigo_barras}/g, transaction.external_id || "-");
  };

  const handleCopy = async (text: string, blockId: string) => {
    const processedText = replaceVariables(text);
    await navigator.clipboard.writeText(processedText);
    setCopiedId(blockId);
    toast.success("Copiado!");
    addActivityLog({
      type: "action",
      category: "Recuperação",
      message: `Mensagem de recuperação copiada para ${transaction?.customer_name || "cliente"}`,
      details: `Valor: ${formatCurrency(Number(transaction?.amount || 0))}`
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyField = async (value: string, fieldId: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(fieldId);
    toast.success("Copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPdf = () => {
    if (pdfBlobUrl) {
      const a = document.createElement("a");
      a.href = pdfBlobUrl;
      a.download = `boleto-${transaction?.customer_name || "cliente"}.pdf`;
      a.click();
    }
  };

  const handleOpenPdfInNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, "_blank");
    }
  };

  const handleSendTextWhatsApp = async (text: string, blockId: string) => {
    if (!transaction?.customer_phone) {
      toast.error("Telefone do cliente não disponível");
      return;
    }

    if (!extensionAvailable) {
      toast.error("Extensão WhatsApp não detectada. Instale a extensão para enviar mensagens.");
      return;
    }

    const processedText = replaceVariables(text);
    setSendingWhatsApp(blockId);

    const success = await sendText(transaction.customer_phone, processedText);
    if (success) {
      toast.success("Mensagem enviada via WhatsApp!");
    } else {
      toast.error("Erro ao enviar mensagem via extensão");
    }

    setSendingWhatsApp(null);
  };

  const handleSendImageWhatsApp = async (blockId: string) => {
    if (!transaction?.customer_phone) {
      toast.error("Telefone do cliente não disponível");
      return;
    }

    if (!imageBlobUrl) {
      toast.error("Imagem não disponível");
      return;
    }

    if (!extensionAvailable) {
      toast.error("Extensão WhatsApp não detectada. Instale a extensão para enviar imagens.");
      return;
    }

    setSendingWhatsApp(blockId);

    try {
      // Convert blob URL to data URL
      const response = await fetch(imageBlobUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const success = await sendImage(transaction.customer_phone, dataUrl);
      if (success) {
        toast.success("Imagem enviada via WhatsApp!");
      } else {
        toast.error("Erro ao enviar imagem via extensão");
      }
    } catch (error) {
      toast.error("Erro ao processar imagem");
    }

    setSendingWhatsApp(null);
  };

  if (!transaction) return null;

  const metadata = transaction.metadata as Record<string, unknown> | null;
  const dueDate = metadata?.due_date ? formatDate(String(metadata.due_date)) : null;

  const renderBlock = (block: RecoveryBlock) => {
    if (block.type === "text") {
      const processedText = replaceVariables(block.content);
      return (
        <div key={block.id} className="flex items-start gap-2 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 flex-1">{processedText}</p>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => handleCopy(block.content, block.id)}
          >
            {copiedId === block.id ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      );
    }

    if (block.type === "pdf") {
      return (
        <div key={block.id}>
          {isLoadingPdf ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Carregando PDF...</span>
            </div>
          ) : pdfBlobUrl ? (
            <a 
              href={pdfBlobUrl}
              download={`boleto-${transaction?.customer_name?.split(" ")[0] || "cliente"}.pdf`}
              className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20 hover:border-red-500/40 transition-all no-underline"
            >
              <div className="w-10 h-12 bg-white rounded shadow-sm flex items-center justify-center border shrink-0">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  boleto-{transaction?.customer_name?.split(" ")[0] || "cliente"}.pdf
                </p>
                <p className="text-xs text-muted-foreground">Clique para baixar</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">PDF não disponível</p>
          )}
        </div>
      );
    }

    if (block.type === "image") {
      return (
        <div key={block.id}>
          {isLoadingImage ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              <span className="text-xs text-muted-foreground">Gerando imagem...</span>
            </div>
          ) : imageBlobUrl ? (
            <a
              href={imageBlobUrl}
              download={`boleto-${transaction?.customer_name?.split(" ")[0] || "cliente"}.jpg`}
              className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all no-underline"
            >
              <div className="w-10 h-12 bg-white rounded shadow-sm flex items-center justify-center border shrink-0 overflow-hidden">
                <img 
                  src={imageBlobUrl} 
                  alt="Boleto" 
                  className="w-full h-full object-cover"
                  draggable="false"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  boleto-{transaction?.customer_name?.split(" ")[0] || "cliente"}.jpg
                </p>
                <p className="text-xs text-muted-foreground">Clique para baixar</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              {isLoadingPdf ? "Aguardando PDF..." : "Imagem não disponível"}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-lg">Recuperação de Boleto</span>
                <p className="text-sm font-normal text-muted-foreground">Copie as mensagens para enviar ao cliente</p>
              </div>
            </DialogTitle>
            {extensionStatus === "connecting" ? (
              <Badge variant="outline" className="gap-1.5 border-amber-500/50 text-amber-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Conectando...
              </Badge>
            ) : extensionStatus === "connected" ? (
              <Badge className="gap-1.5 bg-[#25D366] hover:bg-[#25D366] text-white">
                <Wifi className="h-3 w-3" />
                Extensão conectada
              </Badge>
            ) : (
              <Badge 
                variant="secondary" 
                className="gap-1.5 cursor-pointer hover:bg-muted"
                onClick={retryConnection}
              >
                <WifiOff className="h-3 w-3" />
                Desconectado
                <span className="text-xs opacity-70">(clique para reconectar)</span>
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-0">
          {/* Left side - Boleto Info */}
          <div className="p-6 bg-muted/20 border-b lg:border-b-0 lg:border-r border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Dados do Cliente
              </h4>
              {clickCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {clickCount} contato{clickCount > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            
            <div className="space-y-3">
              {/* Cliente */}
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <User className="h-3.5 w-3.5" />
                  <span>Nome do Cliente</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{transaction.customer_name || "-"}</p>
                  {transaction.customer_name && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(transaction.customer_name!, "name")}>
                      {copiedId === "name" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Telefone */}
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Phone className="h-3.5 w-3.5" />
                  <span>Telefone</span>
                </div>
                {isEditingPhone ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingPhoneValue}
                      onChange={(e) => setEditingPhoneValue(e.target.value)}
                      placeholder="5521999999999"
                      className="h-8 text-sm"
                    />
                    <Button 
                      size="icon" 
                      variant="default" 
                      className="h-7 w-7 shrink-0" 
                      onClick={handleSavePhone}
                      disabled={isSavingPhone}
                    >
                      {isSavingPhone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 shrink-0" 
                      onClick={() => {
                        setIsEditingPhone(false);
                        setEditingPhoneValue(transaction.customer_phone || "");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{transaction.customer_phone || "-"}</p>
                    <div className="flex items-center gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7" 
                        onClick={() => setIsEditingPhone(true)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {transaction.customer_phone && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(transaction.customer_phone!, "phone")}>
                          {copiedId === "phone" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CPF/Documento */}
              {transaction.customer_document && (
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span>CPF</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium font-mono">{transaction.customer_document}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(transaction.customer_document!, "document")}>
                      {copiedId === "document" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Valor - Destacado */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 text-xs text-primary/70 mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Valor do Boleto</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-primary">{formatCurrency(Number(transaction.amount))}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(formatCurrency(Number(transaction.amount)), "value")}>
                    {copiedId === "value" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Vencimento */}
              {dueDate && (
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Vencimento</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{dueDate}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(dueDate, "dueDate")}>
                      {copiedId === "dueDate" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Código de Barras */}
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Barcode className="h-3.5 w-3.5" />
                  <span>Código de Barras</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs text-foreground/80 break-all flex-1">{transaction.external_id || "-"}</p>
                  {transaction.external_id && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleCopyField(transaction.external_id!, "barcode")}>
                      {copiedId === "barcode" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Botão WhatsApp */}
              {transaction.customer_phone && (
                <Button
                  className="w-full gap-2 h-11 mt-4 bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium shadow-lg shadow-[#25D366]/25"
                  onClick={async () => {
                    await registerClick();
                    addActivityLog({
                      type: "action",
                      category: "Recuperação",
                      message: `WhatsApp aberto para recuperação de boleto: ${transaction.customer_name || "cliente"}`,
                      details: `Telefone: ${transaction.customer_phone}, Valor: ${formatCurrency(Number(transaction.amount))}`
                    });
                    console.log("[BoletoRecovery] customer_phone:", transaction.customer_phone);
                    const success = await openChat(transaction.customer_phone!);
                    if (success) {
                      toast.success("Chat aberto! Cole a mensagem com Ctrl+V");
                    } else {
                      toast.error("Não foi possível abrir o chat. Verifique a extensão.");
                    }
                  }}
                >
                  <MessageCircle className="h-5 w-5" />
                  Abrir conversa no WhatsApp
                </Button>
              )}
            </div>
          </div>

          {/* Right side - Recovery messages */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Mensagens de Recuperação
            </h4>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Carregando template...</span>
              </div>
            ) : !template || template.blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
                <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum template configurado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Configure templates nas configurações</p>
              </div>
            ) : (
              <div className="space-y-3">
                {template.blocks
                  .sort((a, b) => a.order - b.order)
                  .map((block) => renderBlock(block))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
