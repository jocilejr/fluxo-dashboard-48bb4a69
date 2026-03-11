

## Plano: Reduzir para 1 mensagem única e dinâmica

### Problema
As 2 mensagens (greeting + tip) ficam repetitivas e desconexas. O usuário quer apenas **1 mensagem** por vez, mas que varie radicalmente entre categorias.

### Mudanças

**1. Edge function `member-ai-context/index.ts`**
- Mudar o prompt para gerar **1 única mensagem** em vez de 2
- Remover o campo `greeting` separado — a saudação com o nome fica integrada na mensagem única
- A mensagem segue a categoria sorteada (salmo, progresso, reflexão, curiosidade, oração, incentivo, pergunta)
- Manter `temperature: 1.1` e regra anti-travessão
- Tool call retorna apenas `{ message: string }` em vez de `{ greeting, followup }`
- Mapear o resultado para `{ greeting: message, tip: "" }` para compatibilidade com o frontend

**2. Frontend `AreaMembrosPublica.tsx`**
- Remover lógica de `showTypingAfterFirst` e revelação sequencial de 2 mensagens
- Mostrar apenas 1 balão de chat (o `greeting`)
- Simplificar: loading dots → mensagem aparece (sem segundo passo)

### Arquivos modificados
- `supabase/functions/member-ai-context/index.ts`
- `src/pages/AreaMembrosPublica.tsx`

