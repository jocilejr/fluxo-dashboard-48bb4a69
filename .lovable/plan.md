

## Redesign: Oferta Fim da Página — Estilo "Apresentação Premium"

O componente atual (`BottomPageOffer.tsx`) tem cara de venda direta — gradientes coloridos, "Por apenas", botão "Quero conhecer". Vou redesenhá-lo com uma abordagem editorial/premium, como uma recomendação curada.

### Conceito Visual

Layout horizontal elegante e minimalista:
- Fundo branco com borda sutil e leve sombra
- Imagem à esquerda com cantos arredondados (sem overlay/gradiente)
- Conteúdo à direita: tag discreta, título com tipografia sóbria (sem font-extrabold), descrição em tom editorial
- Preço discreto (se houver), sem "Por apenas"
- CTA como link sutil com seta, não um botão gritante — texto tipo "Saiba mais →"
- Separador fino acima com label tipo "Você também pode gostar" ou a category_tag
- Em mobile, empilha verticalmente (imagem em cima, conteúdo embaixo)

### Mudanças

**Arquivo: `src/components/membros/BottomPageOffer.tsx`** — Reescrever completamente:
- Remover gradientes, Sparkles, Gift icons, botões com boxShadow colorido
- Layout flex horizontal (lg) / vertical (mobile)
- Imagem com `rounded-xl`, `object-cover`, sem overlay
- Tipografia: `font-semibold` no título, `text-gray-500` na descrição
- CTA discreto: texto com cor do tema + ícone ArrowRight, sem fundo
- Preço em formato limpo sem label "Por apenas"
- Seção envolvida em borda superior com label "Recomendado para você"

