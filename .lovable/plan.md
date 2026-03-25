

## Abrir chat via API interna do WhatsApp Web (sem seletores CSS)

### Problema atual
A extensão usa seletores CSS (`button[data-tab="2"]`, `div[contenteditable="true"][data-tab="3"]`, etc.) que quebram toda vez que o WhatsApp atualiza a interface.

### Solução: Usar os módulos internos do WhatsApp Web

O WhatsApp Web é uma aplicação React empacotada via webpack. Internamente, ele expõe módulos JavaScript que podem ser acessados diretamente — sem depender de nenhum seletor CSS. Ferramentas como `whatsapp-web.js` e `wa-js` usam essa técnica.

A ideia é **injetar um script que escaneia os módulos webpack** do WhatsApp Web e expõe um objeto `window.Store` com acesso direto a funções como `openChatByPhone`. Isso é **100% independente de seletores CSS** — funciona mesmo que o WhatsApp mude toda a interface.

### Como funciona

```text
Extensão envia comando OPEN_CHAT(phone)
    │
    └──► content-whatsapp.js
            │
            ├── [ANTES] Clicava botão "Nova conversa" → buscava input → digitava → clicava contato
            │           (tudo via querySelector — quebrava com updates)
            │
            └── [AGORA] Chama window.Store.OpenChat.openChatByPhone(phone)
                        OU window.WPP.chat.openChatByPhone(phone)
                        → Abre o chat diretamente pela API interna
                        → Zero dependência de seletores CSS
```

### Mudanças

**1. `whatsapp-extension/content-whatsapp.js`**

Adicionar um módulo de injeção que:
- Escaneia `window.require` (webpack) para encontrar os módulos internos do WhatsApp
- Expõe `window.WStore` com referências para `Chat`, `Cmd`, `OpenChat`, `SendMessage`
- Cria funções robustas: `openChatByPhone(phone)` que formata o JID (`55xxxxx@c.us`) e chama a API interna diretamente

Refatorar `openChat()`:
```javascript
// ANTES (quebra com updates CSS):
// const newChatBtn = document.querySelector('button[data-tab="2"]');
// newChatBtn.click(); ...

// DEPOIS (API interna, sem seletores):
async function openChat(phone) {
  const jid = phone.includes('@') ? phone : `${phone}@c.us`;
  
  if (window.WStore?.Chat?.find) {
    // Método 1: Store.Chat.find
    const chat = await window.WStore.Chat.find(jid);
    if (chat) return { success: true };
  }
  
  if (window.WStore?.OpenChat) {
    // Método 2: Store.OpenChat
    await window.WStore.OpenChat(jid);
    return { success: true };
  }
  
  // Método 3: Fallback — dispara evento interno
  const link = document.createElement('a');
  link.href = `whatsapp://send?phone=${phone}`;
  link.click();
  
  return { success: false, error: 'Store not available' };
}
```

Refatorar `prepareText()` — em vez de buscar `footer div[contenteditable]`:
```javascript
async function prepareText(phone, text) {
  if (window.WStore?.SendMessage) {
    const jid = `${phone}@c.us`;
    const chat = await window.WStore.Chat.find(jid);
    // Coloca texto no input via Store, não via DOM
  }
}
```

**2. Novo arquivo: `whatsapp-extension/inject-store.js`**

Script injetado na página (via `world: "MAIN"` no manifest) que:
- Intercepta `window.require` do webpack
- Mapeia módulos por nome (`WAWebCmd`, `WAWebChatCollection`, etc.)
- Expõe `window.WStore` com os módulos necessários
- Re-tenta periodicamente se os módulos não estiverem prontos

**3. `whatsapp-extension/manifest.json`**

Adicionar o script de injeção no `content_scripts` com `"world": "MAIN"` para rodar no contexto da página (necessário para acessar `window.require` do webpack).

```json
"content_scripts": [
  {
    "matches": ["https://web.whatsapp.com/*"],
    "js": ["inject-store.js"],
    "run_at": "document_start",
    "world": "MAIN"
  },
  {
    "matches": ["https://web.whatsapp.com/*"],
    "js": ["content-whatsapp.js"],
    "css": ["styles.css"],
    "run_at": "document_idle"
  }
]
```

**4. `src/hooks/useWhatsAppExtension.ts`**
Sem mudanças necessárias — o protocolo de comunicação (postMessage/chrome.runtime) permanece o mesmo.

### Vantagens
- **Zero dependência de seletores CSS** — imune a atualizações visuais do WhatsApp
- **Mais rápido** — não precisa esperar elementos renderizarem, clicar botões, digitar
- **Mais confiável** — usa a mesma API que o próprio WhatsApp usa internamente

### Risco
- O WhatsApp pode mudar os nomes internos dos módulos webpack (raro, ~1-2x por ano)
- Mitigação: o script tenta múltiplos nomes de módulos conhecidos como fallback

### Arquivos a modificar/criar
- `whatsapp-extension/inject-store.js` — novo, injeção dos módulos internos
- `whatsapp-extension/content-whatsapp.js` — refatorar `openChat`, `prepareText`, `prepareImage`
- `whatsapp-extension/manifest.json` — adicionar inject-store.js com `world: "MAIN"`

