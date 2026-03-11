

## Plano: Melhorar chat da oferta — visual e animações

### Problemas atuais
- Fundo cinza claro (`bg-gray-50`) — sem vida, não parece um chat
- Animação dos 3 pontinhos termina mas a mensagem demora a aparecer (delay de 600ms/1200ms entre mensagens é longo demais)
- Balões muito claros e sem contraste
- Layout não se parece com o chat da imagem de referência

### Mudanças no `LockedOfferCard.tsx`

**Visual do dialog (baseado na imagem de referência):**
- Fundo escuro (`bg-gray-800/900`) no corpo do chat, como um app de mensagens
- Header com gradient do themeColor, avatar maior da Meire Rosana, imagem do produto menor no canto
- Balões com fundo semi-transparente claro, texto branco/claro
- Bordas arredondadas estilo WhatsApp (rounded-tl menor no primeiro balão)

**Animações corrigidas:**
- Reduzir delay entre mensagens: 300ms para a primeira, 800ms para as seguintes
- Os 3 pontinhos devem desaparecer **instantaneamente** quando a mensagem aparece (sem gap visual)
- Usar transição suave com `opacity` + `translateY` em vez de apenas `animate-fade-in`

**Fluxo da animação:**
1. Dialog abre → mostra dots imediatamente
2. API retorna → dots somem, primeira mensagem aparece instantaneamente
3. Após 800ms → dots aparecem brevemente (200ms), segunda mensagem aparece
4. Após todas as mensagens → botão CTA aparece com fade

**Card externo:** manter como está (minimalista conforme aprovado antes)

### Arquivo modificado
- `src/components/membros/LockedOfferCard.tsx`

