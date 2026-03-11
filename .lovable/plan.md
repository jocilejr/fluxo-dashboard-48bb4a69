

## Remover oferta proativa da IA + Gerar copy persuasiva on-click

### Resumo

A IA não deve mais sugerir ofertas na saudação. A sugestão de oferta acontece **apenas quando o membro clica** em um material bloqueado — nesse momento, uma chamada à IA gera uma copy persuasiva personalizada para aquela oferta específica.

### Mudanças

**1. Edge function `member-ai-context/index.ts`**
- Remover o bloco 4 (offerSuggestion) do prompt, dos tools/parameters e do resultado
- Remover dados de ofertas do user prompt (não precisa mais enviar lista de ofertas)
- Manter apenas 3 blocos: greeting, tip, progressMessage
- Remover menção a valores/preços no prompt

**2. Nova edge function `member-offer-pitch/index.ts`**
- Recebe: `firstName`, `offerId`, `offerName`, `offerDescription`, `ownedProductNames`, `profile` (mesmos dados de perfil já calculados)
- Busca a API key da OpenAI no banco
- Prompt focado: "Crie uma copy persuasiva de 2-3 frases para convencer esta pessoa a adquirir [oferta]. Baseie-se no que você sabe sobre ela. NUNCA mencione valores ou preços."
- Retorna: `{ message: string }`

**3. `src/pages/AreaMembrosPublica.tsx`**
- Remover `offerSuggestion` da interface `AiContext` e de todo uso
- Remover o bloco "AI suggested offer" que posiciona a oferta sugerida entre os produtos
- Remover envio de ofertas no payload do `member-ai-context`
- Passar dados de perfil (`profile`) para o `LockedOfferCard` (para que ele possa chamar a IA on-click)

**4. `src/components/membros/LockedOfferCard.tsx`**
- Ao abrir o dialog (click), chamar `member-offer-pitch` com os dados da oferta + perfil do membro
- Mostrar "digitando..." enquanto carrega a resposta
- Exibir a copy da IA no dialog quando pronta
- Remover exibição de preço (`offer.price`)
- Cache a resposta da IA para não chamar novamente se reabrir o mesmo card

**5. `src/pages/AreaMembros.tsx` (preview)**
- Espelhar remoção do offerSuggestion no preview estático

