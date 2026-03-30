

## Plano: Corrigir teste de conexão com API externa

### Problema

O teste de conexão está sendo feito **diretamente do navegador** (frontend) para `https://app.chatbotsimplificado.com/api/platform/contacts?limit=1`. Isso falha por **CORS** -- o navegador bloqueia requisições cross-origin para APIs externas que não permitem explicitamente.

### Solução

Rotear o teste de conexão através de uma **edge function** no backend, que não tem restrição de CORS.

### Alterações

**1. Criar edge function `test-external-connection/index.ts`**
- Recebe `server_url` e `api_key` no body
- Faz `GET {server_url}/api/platform/contacts?limit=1` com `Authorization: Bearer {api_key}` do lado servidor
- Retorna `{ success: true/false, status, error }`

**2. Atualizar `ExternalApiSettings.tsx`**
- Trocar o `fetch` direto para `supabase.functions.invoke('test-external-connection', { body: { server_url, api_key } })`

### Detalhes técnicos
- A edge function precisa de CORS headers padrão para ser chamada pelo frontend
- Não precisa de nova tabela ou migração
- Registrar a function no `supabase/config.toml`

