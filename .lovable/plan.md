## Plano: Tornar mensagens da Meire Rosana dinâmicas e variadas

### Problema

O prompt atual sempre gera o mesmo padrão: saudação + dica genérica. Sem variação real, as mensagens ficam repetitivas e com travessão  
  
A imagem de capa não aparece no card do produto. Resolva isso.

### Solução

Adicionar um **sistema de categorias aleatórias** no backend. A cada chamada, o servidor sorteia uma categoria diferente para a segunda mensagem, forçando a IA a variar radicalmente o conteúdo.  
  
Elimine completamente o travessão da mensagem. Foco total na mensagem com personalidade.   
  


### Categorias (sorteadas aleatoriamente)

1. **Salmo/Versículo** - Compartilhar um salmo ou versículo bíblico relacionado ao momento da pessoa
2. **Progresso** - Comentar especificamente sobre o progresso nos materiais (só quando há progresso real)
3. **Reflexão do dia** - Uma reflexão pessoal curta, como se fosse algo que a Meire pensou naquele momento
4. **Curiosidade bíblica** - Um fato interessante ou história bíblica pouco conhecida
5. **Oração curta** - Uma oração breve e pessoal dedicada à pessoa
6. **Incentivo pessoal** - Palavras de encorajamento contextualizadas
7. **Pergunta carinhosa** - Fazer uma pergunta genuína sobre como a pessoa está

### Mudanças no `member-ai-context/index.ts`

- Criar array de categorias e sortear uma com `Math.random()`
- Reescrever o prompt para instruir a IA a seguir a categoria sorteada
- Incluir a categoria no prompt do usuário para que a IA saiba o que gerar
- Adicionar `temperature: 1.1` para maximizar criatividade
- Reforçar regra: NUNCA usar travessão (—)
- Renomear o campo `tip` para `followup` na tool call com descrição dinâmica baseada na categoria

### Exemplo de lógica

```typescript
const categories = [
  { id: "salmo", instruction: "Compartilhe um salmo ou versículo que combina com o momento dessa pessoa. Cite o livro e versículo." },
  { id: "progresso", instruction: "Comente sobre o progresso dela nos materiais, citando nomes." },
  { id: "reflexao", instruction: "Compartilhe uma reflexão pessoal sua, algo que você pensou hoje de manhã." },
  { id: "curiosidade", instruction: "Conte uma curiosidade bíblica interessante ou história pouco conhecida." },
  { id: "oracao", instruction: "Faça uma oração curta e pessoal dedicada a essa pessoa pelo nome." },
  { id: "incentivo", instruction: "Dê palavras de encorajamento baseadas na situação atual dela." },
  { id: "pergunta", instruction: "Faça uma pergunta carinhosa e genuína sobre como ela está." },
];
const chosen = categories[Math.floor(Math.random() * categories.length)];
```

### Arquivo modificado

- `supabase/functions/member-ai-context/index.ts`