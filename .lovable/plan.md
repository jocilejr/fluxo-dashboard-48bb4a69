

## Diagnóstico

Identifiquei o problema. O hook `sendCommand` envia o telefone SOMENTE dentro de `payload`:

```js
// Hook envia:
{ type: "WHATSAPP_OPEN_CHAT", requestId: "...", payload: { phone: "55..." } }
```

A ponte (`content-dashboard.js`) extrai `payload.phone`. Porém, se a versão instalada da extensão espera o telefone no nível superior (`event.data.phone`), ele chega como `undefined`. Isso explica por que a extensão abre o buscador (recebe o comando OPEN_CHAT) mas não digita nada (`openChat(undefined)` clica "Nova conversa" mas `simulateTyping(el, undefined)` não digita nada).

## Correção

Arquivo: `src/hooks/useWhatsAppExtension.ts`

Na função `sendCommand`, enviar o telefone (e demais dados) tanto no nível superior quanto em `payload`, garantindo compatibilidade com qualquer versão da ponte:

```js
const msg = {
  type: `WHATSAPP_${action}`,
  requestId,
  ...data,        // phone no nível superior → event.data.phone
  payload: data,  // phone em payload → event.data.payload.phone
};
window.postMessage(msg, "*");
```

Isso é uma mudança de 1 linha (adicionar `...data`). Ambos os formatos ficam disponíveis, e qualquer versão do content-dashboard.js funcionará.

