

## Corrigir extensão: registrar content-dashboard + remover sidebar/CSS

### Problemas identificados

1. **`content-dashboard.js` nao esta no manifest.json** -- o content script que faz a ponte entre o dashboard e o background nao esta registrado. Por isso o dashboard mostra "offline".
2. **Sidebar + CSS ainda presentes** -- `content-whatsapp.js` (linhas 244-738) ainda tem toda a logica de sidebar, fetch de dados, renderizacao. O `styles.css` ainda forca `#app { width: calc(100% - 380px) }`, encolhendo o WhatsApp e criando a aba preta.

### Mudancas

**1. `whatsapp-extension/manifest.json`**
- Adicionar `content-dashboard.js` como content script para as URLs do dashboard (`https://*.lovable.app/*`, `https://*.lovableproject.com/*`, `https://fluxo-dashboard.lovable.app/*`)
- Remover `"css": ["styles.css"]` do content script do WhatsApp (nao ha mais CSS a injetar)

**2. `whatsapp-extension/styles.css`**
- Esvaziar completamente. Remover a regra `#app { width: calc(100% - 380px) }` e todos os estilos da sidebar.

**3. `whatsapp-extension/content-whatsapp.js`**
- Remover tudo a partir da linha 244 ate 738 (utilitarios visuais, sidebar, renderizacao, detecao de conversa, init)
- Manter apenas: CONFIG (sem LOGO_URL), WStore bridge, openChat, prepareText, prepareImage, chrome.runtime.onMessage listener, keep-alive ping

**4. Reempacotar `public/whatsapp-extension.zip`**

### Resultado
- Dashboard volta a detectar a extensao (content-dashboard.js registrado no manifest)
- WhatsApp Web fica em tela cheia, sem sidebar nem aba preta
- Extensao funciona como ponte invisivel de comandos

