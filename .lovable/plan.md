

## Diagnóstico

Analisei toda a cadeia de comunicação:

1. **App** → `window.postMessage({ type: "WHATSAPP_OPEN_CHAT", payload: { phone: "55..." } })`
2. **content-dashboard.js** → extrai `payload.phone` → `chrome.runtime.sendMessage({ type: 'OPEN_CHAT', phone: '55...' })`
3. **background.js** → encaminha para tab do WhatsApp
4. **content-whatsapp.js** → `openChat(message.phone)` → digita no campo de busca

Pelo código, a cadeia parece correta. Porém, não consigo identificar com certeza onde o telefone se perde apenas por análise estática. 

**Hipótese principal**: O `sendCommand` pode estar falhando silenciosamente (timeout de 10s, resposta ignorada) ou o telefone está chegando como `undefined` na extensão por algum motivo de timing/serialização.

## Plano: Adicionar logs de diagnóstico em cada etapa

### 1. `src/hooks/useWhatsAppExtension.ts` — logs detalhados

Adicionar `console.log` em pontos críticos para rastrear exatamente o que está sendo enviado:

```typescript
const openChat = useCallback(async (phone: string): Promise<boolean> => {
  const normalized = normalizePhone(phone);
  console.log("[WhatsApp Hook] openChat chamado com:", { raw: phone, normalized });
  return sendCommand("OPEN_CHAT", { phone: normalized });
}, [sendCommand]);
```

E dentro de `sendCommand`, antes do `postMessage`:
```typescript
console.log("[WhatsApp Hook] postMessage enviado:", { 
  type: `WHATSAPP_${action}`, 
  payload: data,
  payloadPhone: data.phone 
});
```

### 2. Verificação no PixCardQuickRecovery e BoletoQuickRecovery

Adicionar log antes de chamar `openChat`:
```typescript
console.log("[Recovery] customer_phone:", transaction.customer_phone);
console.log("[Recovery] phone normalizado:", phone);
```

### Resultado esperado

Com esses logs, ao clicar "Recuperar no WhatsApp", o console do navegador mostrará:
- O telefone bruto do `transaction`
- O telefone após normalização
- O payload exato enviado via `postMessage`
- Se houve timeout ou resposta

Assim poderemos identificar precisamente onde o número se perde — se é na app, no postMessage, ou na resposta da extensão.

