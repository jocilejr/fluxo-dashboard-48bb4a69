

## Plano: Corrigir importação de lembretes da API externa

### Problema

Existem 3 erros na edge function `sync-reminders`:

1. **URL errada**: Usa `settings.server_url` (`https://app.chatbotsimplificado.com/`) + `/api/platform/reminders`. A URL correta para lembretes e `https://api.chatbotsimplificado.com/api/platform/reminders` (dominio `api.` nao `app.`).
2. **Header de autenticacao errado**: Usa `Authorization: Bearer {api_key}`. O correto e `X-API-Key: {api_key}`.
3. **Parsing do response**: O response vem como `{ "data": [...], "count": 32 }`, a function ja trata isso na linha 66, mas precisa garantir.

### Solucao

**1. Atualizar `supabase/functions/sync-reminders/index.ts`**
- Usar URL fixa `https://api.chatbotsimplificado.com/api/platform/reminders` (o dominio da API de lembretes e diferente do `server_url` salvo nas configuracoes)
- Trocar header de `Authorization: Bearer` para `X-API-Key: {api_key}`
- Buscar sem filtro primeiro (pegar todos de uma vez) em vez de 4 requests separadas
- Extrair items de `response.data` (array dentro do objeto)

**2. Atualizar `supabase/functions/external-reminders/index.ts`**
- Mesmas correcoes: URL base `https://api.chatbotsimplificado.com` e header `X-API-Key`

### Detalhes tecnicos
- A `api_key` continua vindo de `messaging_api_settings`
- Nenhuma migracao necessaria
- Ambas as edge functions serao re-deployadas

