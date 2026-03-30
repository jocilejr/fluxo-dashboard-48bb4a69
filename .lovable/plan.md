

## Plano: Implementar Webhooks de Saída (Dashboard → App Externa)

Atualmente, o sistema só recebe webhooks da app externa. Falta o fluxo inverso: quando dados mudam no dashboard, enviar notificações para a app externa.

### O que será feito

**1. Migração: adicionar coluna `webhook_url` na tabela `messaging_api_settings`**
- Campo separado do `server_url` (que é a base da API REST)
- Será a URL onde a app externa recebe os webhooks de saída

**2. Criar edge function `send-outbound-webhook`**
- Recebe `event` e `data` do frontend
- Lê `webhook_url` e `api_key` de `messaging_api_settings`
- Se `webhook_url` estiver configurado, faz POST com o payload padronizado:
  ```json
  {
    "event": "reminder_updated",
    "timestamp": "2026-03-30T14:30:00Z",
    "data": { /* objeto completo */ }
  }
  ```
- Inclui header `X-API-Key`
- Falha silenciosa (não bloqueia o fluxo principal)

**3. Modificar `src/pages/Lembretes.tsx`**
- Após `createMutation` → invocar webhook com evento `reminder_created`
- Após `toggleMutation` → invocar webhook com evento `reminder_updated`
- Após `deleteMutation` → invocar webhook com evento `reminder_deleted`
- Chamadas assíncronas (fire-and-forget), não bloqueiam a UI

**4. Atualizar `src/components/settings/ExternalApiSettings.tsx`**
- Adicionar campo "Webhook URL" na interface de configurações
- Incluir na lógica de save/load o novo campo `webhook_url`
- Documentar na UI os eventos de saída suportados

**5. Atualizar `src/components/dashboard/WebhooksSection.tsx`**
- Documentar os eventos de saída na aba Mensagens

### Eventos de saída implementados
| Evento | Quando |
|---|---|
| `reminder_created` | Lembrete criado no dashboard |
| `reminder_updated` | Lembrete atualizado (toggle, edição) |
| `reminder_deleted` | Lembrete excluído |

### Arquivos alterados
- Nova migração SQL (adicionar `webhook_url`)
- Novo: `supabase/functions/send-outbound-webhook/index.ts`
- `supabase/config.toml` (config da nova function)
- `src/pages/Lembretes.tsx`
- `src/components/settings/ExternalApiSettings.tsx`
- `src/components/dashboard/WebhooksSection.tsx`

### Detalhes técnicos
- A edge function usa `verify_jwt = true` (chamada pelo frontend autenticado)
- O webhook de saída é best-effort: se falhar, loga o erro mas não impede a operação local
- A coluna `webhook_url` tem default vazio, mantendo compatibilidade

