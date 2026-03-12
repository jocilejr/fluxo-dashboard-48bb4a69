

## Diagnóstico

O problema está no hook `useWhatsAppExtension.ts`. Quando `openChat()` é chamado:

1. **Linha 121**: `if (!extensionAvailable) return false;` — se o ping/pong de detecção falhou ou ainda está em "connecting", o comando **nunca é enviado** à extensão. Retorna `false` silenciosamente.

2. **`PixCardQuickRecovery` linha 118**: `await openChat(phone)` — não verifica o retorno. Se retornou `false`, nenhum comando foi enviado, mas o toast de sucesso aparece mesmo assim (linha 120).

3. **Resposta nunca é recebida**: O `content-dashboard.js` responde `WHATSAPP_RESPONSE` **sem `requestId`** (linha 79-87 do content-dashboard.js). O hook exige `matchesRequestId` (linha 89), então a resposta nunca "casa" e dá timeout de 30s.

Resumo: o `openChat` ou não envia nada (extensão "não detectada") ou envia mas nunca recebe confirmação. De qualquer forma, o número não chega ao campo de busca.

## Plano de Correção

### 1. `src/hooks/useWhatsAppExtension.ts` — corrigir `sendCommand` e `openChat`

**a)** Remover o guard `if (!extensionAvailable)` de `openChat`. Sempre enviar o comando — a extensão pode estar ativa mesmo que o ping não tenha sido detectado a tempo.

**b)** Na função `sendCommand`, aceitar resposta `WHATSAPP_RESPONSE` **sem** exigir `requestId` match. Aceitar qualquer `WHATSAPP_RESPONSE` que chegar dentro do timeout como resposta válida (já que os comandos são sequenciais no uso real):

```typescript
const isResponse = event.data?.type === "WHATSAPP_RESPONSE" || 
                   event.data?.type === "WHATSAPP_EXTENSION_RESPONSE";
// Aceitar se requestId bate OU se não tem requestId na resposta
const matchesRequest = !event.data?.requestId || event.data?.requestId === requestId;

if (isResponse && matchesRequest) { ... }
```

**c)** Reduzir timeout de 30s para 10s (suficiente para abrir chat).

### 2. `src/components/dashboard/PixCardQuickRecovery.tsx` — verificar retorno

Na `handleOpenChat`, verificar o retorno de `openChat()`:

```typescript
const success = await openChat(phone);
if (success) {
  toast.success("Mensagem copiada! Cole com Ctrl+V");
} else {
  toast.error("Não foi possível abrir o chat. Verifique a extensão.");
}
```

### 3. `src/components/dashboard/BoletoQuickRecovery.tsx` — mesmo padrão

Nos handlers que usam `openChat`, aplicar a mesma verificação de retorno.

### Resultado esperado
- O comando `OPEN_CHAT` com o telefone será **sempre enviado** à extensão via `window.postMessage`
- A extensão receberá o número e executará a manipulação de DOM (busca + digitação)
- Feedback correto ao usuário sobre sucesso/falha

