

## Plano: Redesign do chat inicial e popup de oferta

### Problemas identificados

1. **Chat da oferta (LockedOfferCard)**: Fundo escuro `#0b141a` destoa completamente da área de membros que é clara (`bg-gray-50`, cards brancos). O botão de fechar do Dialog fica sobreposto à imagem do produto no header.

2. **Chat inicial (AreaMembrosPublica)**: O conteúdo das mensagens AI não agrada — isso é questão do prompt, mas o layout também pode melhorar.

### Mudanças propostas

**1. LockedOfferCard — Popup da oferta (tema claro)**
- Trocar fundo escuro `#0b141a` por `bg-white`
- Header: manter gradient do themeColor mas remover a imagem do produto do canto direito (conflita com botão fechar do Dialog)
- Balões de mensagem: fundo `${themeColor}10` com texto `text-gray-700` (como o chat inicial)
- Typing dots: mesma cor clara
- Botão CTA: manter gradient do themeColor
- Timestamp: `text-gray-400` em vez de `text-white/30`
- Fundo do chat body: branco limpo, sem pattern SVG escuro

**2. Chat inicial (AreaMembrosPublica)**
- Sem mudanças de layout (o problema relatado é sobre o popup da oferta e o conteúdo AI)

### Arquivo modificado
- `src/components/membros/LockedOfferCard.tsx`

