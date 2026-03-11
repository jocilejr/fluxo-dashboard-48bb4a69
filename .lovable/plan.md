

## Corrigir layout bugado do PaymentFlow

### Problema

O dialog do PaymentFlow herda estilos de dark mode do sistema (inputs com fundo escuro, labels cortados, close button sobrepondo o header). O componente usa `bg-white` no container mas os inputs e labels usam classes CSS que respondem ao tema escuro (ex: `bg-background`, `text-foreground`).

### Correções

**`src/components/membros/PaymentFlow.tsx`**:

1. **Forçar cores explícitas light-mode** em todos os elementos (seguindo o padrão já usado em outros componentes da área de membros conforme `area-membros-popup-readability`):
   - Inputs: adicionar classes explícitas `bg-white text-gray-900 border-gray-300 placeholder:text-gray-400`
   - Labels: usar `text-gray-700` explícito
   - Close button (X) do Dialog: esconder o default e não conflitar com o header colorido — o header já tem o botão de voltar, e o close do dialog fica invisível sobre o gradiente

2. **Esconder o botão X padrão do DialogContent** que sobrepõe o header com gradiente — usar `[&>button]:hidden` ou posicionar corretamente com cor branca

3. **Adicionar `DialogTitle` invisível** para acessibilidade (evitar warning do Radix)

4. **Garantir `p-0` e `gap-0`** no DialogContent para que o header colorido fique grudado no topo sem espaçamentos extras

### Arquivos
- **Editado**: `src/components/membros/PaymentFlow.tsx` — forçar cores light-mode explícitas em inputs, labels, textos e ajustar close button

