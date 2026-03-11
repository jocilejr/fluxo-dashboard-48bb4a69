

## Redesign dos Cards de Oferta

O problema: os cards de oferta nas seções `ai_offer` e `offers` ainda usam o layout antigo (card grande com imagem 16/10, preço grande, botão full-width). Apenas o `inline` foi atualizado. Preciso redesenhar o card padrão (não-inline) para ser igualmente sutil e profissional.

### Mudanças em `LockedOfferCard.tsx`

Redesenhar o card padrão (quando `inline=false`) para um layout horizontal compacto similar ao inline, mas com um pouco mais de destaque:

- **Layout horizontal**: imagem à esquerda (h-20 w-24 rounded-xl) + conteúdo à direita
- **Remover**: aspect-ratio 16/10, blur na imagem, preço gigante, botão full-width "Quero adquirir"
- **Manter**: badge de cadeado sobre a imagem, category_tag, nome do produto
- **Adicionar**: texto IA como destaque principal (quando disponível), link sutil "Conhecer →"
- **Para `isHighlighted`**: borda colorida sutil + badge "Recomendado" compacto, sem ring/shadow excessivo

O card destacado (`ai_offer`) e os cards normais (`offers`) terão o mesmo componente base, com a diferenciação visual vindo apenas da borda e badge.

### Arquivo

| Arquivo | Mudança |
|---|---|
| `src/components/membros/LockedOfferCard.tsx` | Redesign completo do card padrão (non-inline) para layout horizontal compacto |

