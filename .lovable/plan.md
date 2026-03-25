
### Objetivo
Substituir a dependência do clique no “primeiro card” por uma abertura **interna real** do chat (API interna do WhatsApp Web), deixando o DOM apenas como fallback de contingência.

### Diagnóstico (resumo)
**Do I know what the issue is? Sim.**  
O problema principal não é só o clique do card: o fluxo está caindo no DOM porque o `WStore` quase nunca fica pronto (`No webpack require resolved`), então a camada interna falha cedo. No fallback DOM, o script encontra elementos visuais, mas não aciona de forma confiável o handler correto do item de resultado.

### Problema exato
1. `inject-store.js` depende de um bootstrap frágil de `require` e não está robusto para variações atuais do loader.
2. Sem camada interna estável, o fluxo depende do card do modal.
3. No modal “Nova conversa”, o alvo clicado nem sempre é o nó interativo real do resultado.

### Plano de implementação
1. **Reestruturar `whatsapp-extension/inject-store.js` para abertura interna prioritária**
   - Implementar resolvedor de runtime em cascata: `window.require` → `__webpack_require__` → chunk injection compatível com versões novas.
   - Parar de depender só de “achar módulos por shape”; priorizar **módulos nomeados** (`WAWebWidFactory`, `WAWebCollections`, `WAWebFindChatAction`, `WAWebCmd`).
   - Expor `WStore.openChat(phone)` usando fluxo interno:
     - criar `wid` do número
     - `Chat.get(wid)` ou `findOrCreateLatestChat(wid)`
     - abrir via `Cmd.openChatBottom` (com assinaturas alternativas), fallback `openChatAt`
   - `WStoreReady` só será `true` quando os módulos mínimos internos existirem.

2. **Fortalecer contrato entre `content-whatsapp.js` e WStore**
   - Antes do DOM fallback, aguardar bootstrap interno com timeout curto e retries controlados.
   - Tentar `openChat` interno novamente após breve recheck (para evitar queda prematura no DOM).
   - Propagar no retorno o método real usado (`store-openChatBottom`, `store-openChatAt`, etc.) para diagnóstico.

3. **Manter fallback DOM, mas com alvo determinístico (sem teclado)**
   - Restringir busca de resultados ao container do modal “Nova conversa”.
   - Priorizar nós semanticamente clicáveis (`[role=button]`, `a[href*="/send"]`, items com `data-testid` de resultado).
   - Clicar no nó interativo mais próximo do texto/número encontrado (não no wrapper genérico).
   - Validar sucesso por mudança de chat ativa e fechamento do modal; se não confirmar, nova tentativa DOM estruturada (sem `ArrowDown/Enter`).

4. **Melhorar telemetria para encerrar loop de tentativas cegas**
   - Logs objetivos por etapa: `store-bootstrap`, `store-open`, `dom-target-selected`, `chat-confirmed`.
   - Erros retornados com causa técnica curta (ex.: `store_modules_missing`, `chat_not_confirmed_after_click`).

5. **Reempacotar extensão**
   - Atualizar `public/whatsapp-extension.zip` com os arquivos alterados.

### Detalhes técnicos (referência)
```text
OPEN_CHAT(phone)
  ├─ Layer A (preferencial): WStore internal modules
  │    WidFactory -> FindOrCreateLatestChat -> Cmd.openChatBottom/openChatAt
  │    confirmação de chat ativa
  └─ Layer B (fallback): DOM modal Nova conversa
       digita número -> resolve item clicável real -> clique nativo -> confirma chat
```

### Arquivos que serão alterados
- `whatsapp-extension/inject-store.js` (principal)
- `whatsapp-extension/content-whatsapp.js`
- `public/whatsapp-extension.zip`

### Critérios de aceite
- Número não salvo abre conversa **sem depender** do clique frágil no card (via camada interna).
- Se camada interna indisponível, fallback DOM abre o primeiro resultado corretamente sem teclado.
- Fluxo não usa `ArrowDown + Enter`.
