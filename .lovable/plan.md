

## Problema

Quando o painel "Nova conversa" abre, o campo de busca **já está focado e pronto para digitação**. A função `typeInEditable` dispara `mousedown`/`mouseup`/`click`/`focus` desnecessariamente, o que **desfoca ou seleciona outro elemento**, quebrando a inserção do texto.

## Solução

Simplificar `typeInEditable` para **apenas inserir o texto** via `document.execCommand('insertText')`, sem clicar, sem focar, sem manipular seleção. O campo já está ativo — basta digitar.

## Alteração

**`whatsapp-extension/content-whatsapp.js`** — reescrever `typeInEditable` (linhas 80-124):

```js
async function typeInEditable(el, text) {
  if (!el) return;
  // O campo já está focado ao abrir o painel. Apenas inserir o texto.
  document.execCommand('insertText', false, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
}
```

Remover toda a lógica de:
- `mousedown` / `mouseup` / `click` / `focus`
- Seleção e limpeza de conteúdo existente (`selectNodeContents`, `delete`)
- Posicionamento de cursor (`collapse`)
- Fallback caractere por caractere

**`public/whatsapp-extension.zip`** — reempacotar.

