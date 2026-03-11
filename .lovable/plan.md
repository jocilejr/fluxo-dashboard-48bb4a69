

## Redesign da Área de Membros: Loading IA, Layout de Produtos e Paleta Visual

### Problemas Identificados

1. **Mensagem IA sem loading state** -- quando a IA demora, a seção simplesmente não aparece, sem feedback visual
2. **Box da IA sobrepondo o header** -- o greeting card está colado no topo do main com `-mt-1`, invadindo o header
3. **Paleta de cores genérica** -- tons de stone/amber/gray muito apagados, sem personalidade
4. **Produtos sem indicador de "adquirido"** -- não há diferenciação visual entre produto desbloqueado e bloqueado
5. **IA não sugere produto entre os cards de produto** -- a sugestão fica isolada no final da página

### Plano

#### 1. Loading state para IA ("Escrevendo...")

Adicionar estado `aiLoading` (true enquanto a edge function não respondeu). Enquanto `aiLoading && !aiContext`, renderizar um skeleton card com animação de typing dots e texto "Preparando sugestões personalizadas...".

#### 2. Corrigir sobreposição header/conteúdo

Remover o `-mt-1` do `<main>` e adicionar `pt-4` para dar espaço adequado entre o final da onda SVG do header e o primeiro card de conteúdo.

#### 3. Nova paleta de cores da página

Substituir o fundo `from-stone-50 to-white` por uma paleta mais moderna e sofisticada:
- Fundo principal: `from-slate-50 via-white to-indigo-50/20`
- Cards com fundo `bg-white/80 backdrop-blur-sm` para efeito glass sutil
- Header com gradiente mais rico usando o `themeColor` com overlays
- Bordas mais definidas com `border-slate-200`

#### 4. Product cards com badge "Verificado / Adquirido"

Redesenhar `renderProductCard` para incluir:
- Um ícone de check/shield verde com texto "Adquirido" ao lado do nome do produto
- Borda lateral mais grossa e colorida
- Remover o badge genérico "Mais recente" e substituir por indicador de verificação

#### 5. Sugestão IA entre produto 1 e produto 2

Alterar o layout para que, em vez de seções separadas "recent_product" e "other_products", a página renderize uma lista unificada de produtos intercalada:
- **Produto 1** (com badge verificado)
- **Sugestão IA** (oferta bloqueada com cadeado, selecionada pela IA)
- **Produto 2+** (com badge verificado)

Isso substitui a seção `ai_offer` que ficava no final. O card de oferta sugerida terá visual distinto: fundo com gradiente sutil, ícone de cadeado, e a mensagem da IA explicando por que aquele material é complementar.

#### 6. Atualizar `defaultLayout`

Novo layout padrão: `["greeting", "products_interleaved", "ai_tip", "verse", "offers"]`

A seção `products_interleaved` renderiza internamente: produto[0] → ai_offer → produto[1..n].

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/AreaMembrosPublica.tsx` | Loading state IA, nova paleta, products interleaved, badge verificado, fix overlap |
| `src/components/membros/LockedOfferCard.tsx` | Ajustar visual do card bloqueado para funcionar inline entre produtos |

