

## Plano: Corrigir chat da Meire Rosana para parecer conversa real

### Problema
As mensagens da IA aparecem como blocos desconexos, sem fluxo de conversa. A IA usa travessões e linguagem que não parece um chat natural. Falta continuidade entre greeting e tip.

### Mudanças

**1. Prompt do `member-ai-context` (edge function)**
- Alterar a instrução para gerar mensagens como **balões de WhatsApp em sequência**, não blocos independentes
- Adicionar regra explícita: "NUNCA use travessão (—)" 
- Mudar a estrutura: em vez de "greeting" e "tip" separados, pedir uma **conversa fluida** onde a segunda mensagem é continuação natural da primeira (como se a pessoa tivesse mandado duas mensagens seguidas no WhatsApp)
- Exemplo no prompt: "Oi Jocile! Que tal dar uma olhada no Pergaminho de Santo Antônio novamente? 📜" seguido de "Você tem materiais incríveis como Santo Antônio e Água que Cura, já começou a aplicar o que aprendeu?"

**2. Layout do chat em `AreaMembrosPublica.tsx`**
- Adicionar animação sequencial (reveal com delay) para as mensagens, simulando digitação real
- Mostrar dots de digitação antes de cada mensagem aparecer
- Manter a estrutura visual atual (balões claros com themeColor)

### Arquivos modificados
- `supabase/functions/member-ai-context/index.ts` — prompt reescrito para conversa fluida sem travessões
- `src/pages/AreaMembrosPublica.tsx` — animação sequencial de reveal das mensagens

