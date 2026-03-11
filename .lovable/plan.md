

## Redesign: Página de Membros Clara, Horizontal, para Idosos

### Mudanças Principais

**1. Tema Claro** -- Fundo branco/cinza claro (`bg-gray-50`), textos escuros. Sem dark mode.

**2. Cards Horizontais de Produto**
- Imagem quadrada à esquerda (do `page_logo` do produto, ~64x64px, `rounded-xl`)
- Nome do produto à direita em texto bold escuro
- Badge: "Liberado recentemente" (verde) para o mais novo, "Liberado" para os demais
- Ao clicar: abre popup com os materiais do produto (não expande inline)
- Fundo branco, borda sutil, sombra leve

```text
┌─────────────────────────────────┐
│ [IMG]  Água que Cura            │
│        ✓ Liberado recentemente  │
└─────────────────────────────────┘
```

**3. Cards de Oferta Bloqueada** -- Mesmo layout horizontal dos produtos, mas:
- Imagem com filtro grayscale + opacidade reduzida
- Ícone de cadeado sobre a imagem
- Badge: "🔒 Toque para saber mais"
- Ao clicar: popup com mensagem IA + botão CTA

**4. Conteúdo em Popup** -- Clicar no produto abre um Dialog com a lista de materiais (MaterialCard). Sem expansão inline. O `ProductContentViewer` será renderizado dentro do popup.

**5. Adicionar `cover_image_url` à tabela `member_product_materials`** -- Para que cada material possa ter uma imagem de capa quadrada (o admin define). Usado nos MaterialCards dentro do popup.

**6. Header Limpo e Claro**
- Fundo branco com borda inferior sutil
- Logo + "Olá, Junior!" + saudação IA como subtítulo
- Faixa fina do themeColor no topo (4px)

**7. DailyVerse e AI Tip** -- Adaptados para tema claro (textos escuros, fundo branco)

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/AreaMembrosPublica.tsx` | Tema claro, cards horizontais, produto abre popup em vez de expandir |
| `src/components/membros/LockedOfferCard.tsx` | Layout horizontal idêntico ao produto, tema claro |
| `src/components/membros/DailyVerse.tsx` | Tema claro |
| `src/components/membros/ProductContentViewer.tsx` | Textos adaptados para tema claro |
| `src/components/membros/MaterialCard.tsx` | Textos adaptados para tema claro |
| Migration SQL | Adicionar `cover_image_url TEXT` à tabela `member_product_materials` |

