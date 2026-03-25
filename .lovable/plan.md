

## Corrigir openChat: moduleRaid robusto + DOM fallback resiliente

### Diagnóstico

O fluxo atual falha em duas camadas:
1. **WStore** — o scan de módulos webpack não encontra os módulos (WhatsApp mudou nomes/estrutura)
2. **DOM fallback** — encontra o botão "nova conversa" e clica, mas não acha o campo de busca porque `data-tab="3"` mudou. Resultado: abre/fecha o painel sem digitar nada.

### Solução em 3 camadas

```text
openChat(phone)
  │
  ├─ Camada 1: moduleRaid (webpack modules)
  │   → Usa webpackChunkwhatsapp_web_client (nome real do chunk)
  │   → Escaneia TODOS os módulos exportados buscando padrões conhecidos
  │   → Chat.find(jid) + Cmd.openChatAt(chat)
  │
  ├─ Camada 2: DOM resiliente (sem data-tab fixo)
  │   → Busca botão por data-testid="chat-list-search" ou ícone SVG
  │   → Busca campo de busca por: qualquer [contenteditable][role="textbox"]
  │     que apareça APÓS clicar (via MutationObserver)
  │   → Digita o número e clica no primeiro resultado
  │
  └─ Camada 3: Navegação interna (fallback final)
      → Usa history.pushState + popstate para simular
        navegação para /send?phone=X dentro do SPA
      → Não recarrega a página inteira
```

### Mudanças

**1. `whatsapp-extension/inject-store.js`** — Reescrever com moduleRaid robusto

- Usar `webpackChunkwhatsapp_web_client` (nome real) em vez de prefixo genérico
- Implementar moduleRaid: injetar chunk falso para capturar `__webpack_require__`, iterar por TODOS os módulos no cache (`require.c`)
- Expandir padrões de busca:
  - `Chat`: `m.findChat`, `m.Chat?.find`, `m.ChatCollection`, `m.default?.find` com propriedade `id` que contém `@`
  - `Cmd`: `m.openChatAt`, `m.Cmd?.openChatAt`, qualquer export com `openChatAt` ou `openChatBottom`
  - `WapQuery`: `m.queryExists`, `m.queryPhoneExists`
  - Busca genérica: iterar todas as keys de cada módulo procurando funções com nome matching

**2. `whatsapp-extension/content-whatsapp.js`** — DOM fallback resiliente

Substituir seletores fixos por estratégia adaptativa:

- **Encontrar botão de busca**: usar lista ampla de seletores + fallback por ícone SVG (`path[d*="search"]` dentro de buttons)
- **Encontrar campo de busca**: em vez de `data-tab="3"`, usar **MutationObserver** que detecta qualquer novo `[contenteditable="true"]` ou `[role="textbox"]` que apareça após clicar no botão
- **Encontrar contato**: buscar por `[data-testid="cell-frame-container"]`, `[role="listitem"]`, ou qualquer elemento clicável que contenha o número
- **Encontrar campo de mensagem**: mesma lógica — qualquer `[contenteditable="true"]` dentro de `footer` ou `[data-testid="conversation-compose-box"]`

**3. Reempacotar `public/whatsapp-extension.zip`**

### Arquivos
- `whatsapp-extension/inject-store.js` — reescrito
- `whatsapp-extension/content-whatsapp.js` — DOM fallback refatorado
- `public/whatsapp-extension.zip` — atualizado

