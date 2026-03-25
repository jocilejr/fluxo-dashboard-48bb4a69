

## Plano: Simplificar extensão — 1 caminho único, sem fallbacks, sem reload

### Diagnóstico

O código atual tem **3 camadas** (WStore, DOM, URL) com **4+ estratégias de clique** (React Fiber, native events, elementFromPoint, interactive child). Cada camada interfere na anterior. O WStore quase nunca bootstrapa. O URL reload é inaceitável. O resultado: nada funciona de forma confiável.

### Solução: 1 fluxo único, 3 passos simples

```text
OPEN_CHAT(phone)
  1. Abrir painel "Nova conversa" (clicar no botão)
  2. Digitar o número (execCommand no campo de busca)
  3. Clicar no resultado (clique nativo simples no primeiro item)
```

Sem WStore. Sem URL. Sem React Fiber. Sem elementFromPoint. Sem múltiplas estratégias.

### Implementação

**1. `whatsapp-extension/content-whatsapp.js` — reescrever drasticamente (~150 linhas)**

Manter apenas:
- `findNewChatButton()` — encontrar botão "Nova conversa" (já funciona)
- `waitForSearchInput()` — aguardar campo de busca aparecer via MutationObserver
- `insertTextInEditable()` — digitar número via `document.execCommand('insertText')` (já funciona)
- `waitForFirstResult()` — aguardar primeiro resultado aparecer via MutationObserver
- `clickFirstResult()` — `.click()` nativo no primeiro `[data-testid*="cell-frame"]` ou `[role="listitem"]`
- `waitForMessageInput()` — confirmar que o chat abriu (input de mensagem visível)

Remover TUDO de:
- WStore bridge (`wstoreReady`, `callWStore`, listeners)
- `openResultFromList` com 4 estratégias de clique
- `triggerReactClick`, `getReactFiberKey`, `getReactPropsKey`
- `fireNativeClick` com pointer/mouse events complexos
- `openChatViaURL` (pushState + location.assign)
- `getActiveChatSignature`, `isChatSelectionConfirmed`, `waitForChatSelection`
- `isNewChatPanelOpen` com busca por texto em todos os spans
- Múltiplos seletores redundantes para busca de resultado

Fluxo `openChat(phone)`:
```
1. btn = querySelector('[data-testid="chatlist-header-new-chat-button"]') ou span[data-icon="new-chat-outline"]
2. btn.click() → esperar campo de busca (MutationObserver, max 3s)
3. execCommand('insertText', phone) no campo de busca → esperar resultado (MutationObserver, max 3s)
4. resultado.click() → esperar input de mensagem (max 3s)
5. Retornar success/failure
```

**2. `whatsapp-extension/inject-store.js` — REMOVER**

O WStore nunca funciona de forma confiável. Remover completamente.

**3. `whatsapp-extension/manifest.json` — remover entrada do inject-store.js**

Remover o bloco content_scripts que referencia `inject-store.js` com `world: "MAIN"`.

**4. Reempacotar `public/whatsapp-extension.zip`**

### O que NÃO terá

- Nenhum fallback com reload
- Nenhum pushState/popstate
- Nenhum WStore/moduleRaid
- Nenhum React Fiber click
- Nenhum ArrowDown/Enter
- Nenhum elementFromPoint multi-ponto
- Nenhuma camada alternativa

### Arquivos alterados
- `whatsapp-extension/content-whatsapp.js` (reescrito, ~150 linhas vs 753 atual)
- `whatsapp-extension/inject-store.js` (removido)
- `whatsapp-extension/manifest.json` (remover inject-store)
- `public/whatsapp-extension.zip` (reempacotado)

