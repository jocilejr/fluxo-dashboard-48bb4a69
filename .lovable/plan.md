
Objetivo: trocar completamente a etapa de inserção do número (remover método atual + fallback) por uma terceira abordagem, sem clique e sem foco extra.

1) Corrigir alvo de digitação (causa provável do “campo visual em branco”)
- Ajustar `findSearchInput()` para priorizar o campo real do modal:
  - elementos com `aria-label` de busca (`Pesquisar nome ou número` / `Search name or number`) + `contenteditable`.
  - se existir, priorizar `document.activeElement` quando ele for editável e estiver no painel esquerdo.
- Só usar heurística genérica como último recurso.
- Adicionar log do seletor/atributos do alvo escolhido (para confirmar que não está digitando em outro `contenteditable` invisível).

2) Remover as duas estratégias atuais de inserção
- Em `typeInEditable`, remover:
  - `el.textContent = text` + `InputEvent` atual.
  - fallback com `execCommand('insertText')`.
- Remover também qualquer limpeza/foco/click relacionado a esse passo.

3) Implementar uma terceira estratégia única (sem fallback)
- Criar inserção por `Selection + Range` no próprio elemento alvo:
  - criar range no fim do conteúdo do alvo,
  - disparar `beforeinput` (`insertText`),
  - inserir nó de texto com o número,
  - disparar `input` após a inserção.
- Essa abordagem não depende de `execCommand`, não usa clique/foco e não troca o elemento selecionado.

4) Validar inserção pelo próprio campo correto
- Após inserir, validar no mesmo elemento alvo (`innerText/textContent`) que o número está presente.
- Se não estiver, retornar erro explícito (`number_insert_failed`) em vez de seguir para “clicar resultado”.
- Manter o restante do fluxo (aguardar resultados e clicar primeiro item) inalterado.

5) Garantir que a mudança não quebre outras rotas
- Separar função para busca de contato (número) da função usada em `prepareText` (campo de mensagem), para não acoplar comportamentos diferentes de editor.
- Reempacotar `public/whatsapp-extension.zip` após alteração.

Critérios de aceite
- Ao abrir “Nova conversa”, o campo visível de busca mostra o número digitado.
- Não ocorre clique/foco extra no campo.
- Se não inserir, retorna erro claro e não avança para seleção de resultado.
