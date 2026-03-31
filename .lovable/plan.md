

## Plano: Corrigir status "pendente" que nunca atualiza

### Problema
A API externa (`chatbotsimplificado.com`) retornou HTML em vez de JSON (provavelmente uma página de erro). A linha `await sendResponse.json()` lança uma exceção `SyntaxError`, que pula todo o bloco de atualização do `message_log`. Resultado: o status fica preso em "pending" para sempre.

### Causa raiz
`send-external-message/index.ts` linha 118: `const sendData = await sendResponse.json()` — sem tratamento para respostas não-JSON.

### Correção

1. **Envolver o parse da resposta em try/catch** em `supabase/functions/send-external-message/index.ts`:
   - Tentar `sendResponse.json()` primeiro
   - Se falhar (HTML, texto, etc.), capturar via `sendResponse.text()` e usar como erro
   - Garantir que o `message_log` seja sempre atualizado para `'failed'` com a mensagem de erro real
   - O fluxo nunca mais ficará preso em "pending"

2. **Adicionar header `Accept: application/json`** na requisição à API externa para sinalizar que esperamos JSON.

### Arquivo alterado
- `supabase/functions/send-external-message/index.ts`

