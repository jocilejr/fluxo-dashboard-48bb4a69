

## Envio de Mídia na Auto Recuperação

### Objetivo
Permitir que o auto-recovery envie mídias (imagem do boleto, PDF) junto com a mensagem de texto, usando o endpoint separado `/api/platform/send-media` da API externa.

### Como funciona hoje
- `send-external-message` envia apenas texto via `POST /api/platform/send-message`
- Boletos têm `boleto_url` armazenado em `transactions.metadata.boleto_url`
- A conversão PDF→imagem já existe no frontend (`src/lib/pdfToImage.ts`), mas não no backend

### Alterações

#### 1. Expandir `send-external-message` para suportar mídia
**Arquivo:** `supabase/functions/send-external-message/index.ts`

- Adicionar campo opcional `mediaAttachments` no request:
  ```ts
  mediaAttachments?: Array<{
    media_url: string;
    type: 'image' | 'document';
    caption?: string;
  }>;
  ```
- Após enviar a mensagem de texto com sucesso, enviar cada mídia via `POST /api/platform/send-media` com payload:
  ```json
  { "phone": "...", "media_url": "...", "type": "document", "caption": "Boleto", "instance": "..." }
  ```
- Registrar no `message_log` se as mídias foram enviadas com sucesso

#### 2. Atualizar `auto-recovery` para anexar mídia nos boletos
**Arquivo:** `supabase/functions/auto-recovery/index.ts`

- Na seção de recuperação de boleto, buscar `metadata.boleto_url` da transação
- Se existir, montar o array `mediaAttachments` com:
  - PDF do boleto (`type: 'document'`)
- Passar `mediaAttachments` para `send-external-message`

#### 3. Adicionar configuração de mídia na UI (opcional por tipo)
**Arquivo:** `src/pages/AutoRecuperacao.tsx`

- Na aba Boleto, adicionar toggle "Enviar PDF do boleto junto com a mensagem"
- Salvar como nova coluna `boleto_send_pdf` em `messaging_api_settings`

#### 4. Migração de banco
- Adicionar coluna `boleto_send_pdf boolean DEFAULT true` em `messaging_api_settings`

### Fluxo de envio (boleto)
```text
auto-recovery
  ├─ Monta mensagem de texto
  ├─ Verifica se boleto tem boleto_url no metadata
  ├─ Chama send-external-message com:
  │   ├─ message (texto)
  │   └─ mediaAttachments: [{media_url: boleto_url, type: 'document', caption: 'Boleto'}]
  │
send-external-message
  ├─ POST /api/platform/send-message (texto)
  └─ Para cada mídia:
      └─ POST /api/platform/send-media (arquivo)
```

### Arquivos alterados
- `supabase/functions/send-external-message/index.ts` — suporte a envio de mídia
- `supabase/functions/auto-recovery/index.ts` — anexar boleto_url como mídia
- `src/pages/AutoRecuperacao.tsx` — toggle de envio de PDF
- Migração SQL — coluna `boleto_send_pdf`

