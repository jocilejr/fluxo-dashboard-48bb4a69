

## Corrigir visualização de PDF no popup

### Problemas identificados

1. **PDF não renderiza inline no iframe** — URLs do Supabase Storage servem PDFs com header `Content-Disposition: attachment`, o que faz o navegador mostrar um botão "Abrir" ao invés de renderizar o conteúdo.
2. **Botão X desnecessário** — O `DialogContent` inclui um botão X padrão do Radix, mas já existe o botão "Voltar".

### Solução

**Arquivo: `src/components/membros/MaterialCard.tsx`**

1. **Renderizar PDF com Google Docs Viewer** — Envolver a URL do PDF no Google Docs Viewer (`https://docs.google.com/gview?url=URL&embedded=true`) para exibir o PDF inline no iframe, sem depender dos headers do storage.

2. **Esconder o botão X** — No `DialogContent` do PDF, adicionar a classe `[&>button:last-child]:hidden` para ocultar o close button padrão do Radix, já que o "Voltar" cumpre essa função.

### Mudanças específicas

```tsx
// DialogContent do PDF — esconder X
<DialogContent className="w-[98vw] max-w-[98vw] h-[95vh] max-h-[95vh] flex flex-col p-0 overflow-hidden gap-0 [&>button:last-child]:hidden">

// iframe — usar Google Docs Viewer
<iframe
  src={`https://docs.google.com/gview?url=${encodeURIComponent(material.content_url || "")}&embedded=true`}
  className="w-full flex-1 border-0"
  title={material.title}
/>
```

