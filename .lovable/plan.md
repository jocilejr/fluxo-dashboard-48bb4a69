

## Blocos de mídia por regra na Régua de Cobrança

### Objetivo
Cada regra da régua de cobrança terá seus próprios blocos configuráveis (Texto, PDF, Imagem), em vez de apenas um campo de mensagem. Isso permite definir individualmente o que cada regra envia: só texto, texto + PDF, texto + imagem, ou qualquer combinação.

### Alterações

#### 1. Migração SQL
Adicionar coluna `media_blocks` (JSONB) na tabela `boleto_recovery_rules`:
```sql
ALTER TABLE public.boleto_recovery_rules 
ADD COLUMN media_blocks jsonb NOT NULL DEFAULT '[]'::jsonb;
```
Formato: `[{ "type": "pdf", "enabled": true }, { "type": "image", "enabled": true }]`

Remover a coluna global `boleto_send_pdf` de `messaging_api_settings` (adicionada na última alteração) já que agora cada regra controla isso individualmente.

#### 2. UI — `BoletoRecoveryRulesConfig.tsx`
No formulário de edição de cada regra, abaixo do campo "Mensagem", adicionar toggles/checkboxes:
- **Enviar PDF do boleto** (toggle) — envia o PDF como documento
- **Enviar Imagem do boleto** (toggle) — envia imagem do boleto

Visual similar ao `BoletoRecoveryModal`: badges coloridas (PDF em amarelo, IMG em verde) com ícones `FileText` e `Image`.

Na lista de regras, mostrar badges indicando quais mídias estão habilitadas (ex: `TXT` `PDF` `IMG`).

#### 3. Backend — `auto-recovery/index.ts`
Ao processar cada regra de boleto:
- Ler `rule.media_blocks` para montar o array `mediaAttachments`
- Se PDF habilitado e `boleto_url` existe → adicionar `{ type: 'document', media_url: boleto_url }`
- Se Image habilitado e `boleto_url` existe → adicionar `{ type: 'image', media_url: boleto_url }`
- Remover referência ao `settings.boleto_send_pdf` global

#### 4. Remover toggle global
Remover o toggle "Enviar PDF do boleto" da página `AutoRecuperacao.tsx` (aba Boleto), já que agora é configurado por regra.

### Arquivos alterados
- Migração SQL — nova coluna `media_blocks` + remover `boleto_send_pdf`
- `src/components/dashboard/BoletoRecoveryRulesConfig.tsx` — toggles de mídia no editor de regra
- `supabase/functions/auto-recovery/index.ts` — ler `media_blocks` da regra
- `src/pages/AutoRecuperacao.tsx` — remover toggle global de PDF

