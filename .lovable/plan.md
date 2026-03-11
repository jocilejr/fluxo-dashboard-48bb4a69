

## Adicionar tipo "Produto Físico" nas ofertas

### Resumo

Adicionar uma terceira opção de `display_type` chamada `showcase` (Produto Físico) no seletor de tipo de exibição do painel admin, e renderizar essa oferta como uma vitrine dedicada na página pública da área de membros.

### Alterações

**1. Painel Admin (`src/pages/AreaMembros.tsx`)**
- Adicionar `<SelectItem value="showcase">Produto Físico (Vitrine)</SelectItem>` no seletor de tipo de exibição (linha ~386)
- Atualizar o Badge na listagem de ofertas (linha ~419) para mostrar "Produto Físico" quando `display_type === 'showcase'`

**2. Novo componente `src/components/membros/PhysicalProductShowcase.tsx`**
- Seção visual com GIF/imagem em destaque (aspect-ratio 16:9, bordas arredondadas)
- Título da oferta estilizado
- Descrição opcional
- Botão CTA "Reservar o seu ✨" com animação pulse, abrindo `purchase_url`
- Fundo com gradiente suave usando `themeColor`

```text
┌──────────────────────────────┐
│  ┌────────────────────────┐  │
│  │   GIF / Imagem         │  │
│  │   (16:9, object-cover) │  │
│  └────────────────────────┘  │
│                              │
│  ✨ Nome da oferta           │
│  Descrição breve...          │
│                              │
│  ┌────────────────────────┐  │
│  │   Reservar o seu →     │  │  ← pulse animation
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**3. Página pública (`src/pages/AreaMembrosPublica.tsx`)**
- Filtrar ofertas `showcase` separadamente: `filteredOffers.filter(o => o.display_type === 'showcase')`
- Excluir ofertas `showcase` do filtro de `cardOffers` (atualmente pega tudo que não é `bottom_page`)
- Renderizar a seção de vitrine entre os produtos intercalados e o `<DailyVerse />`
- Importar e usar `PhysicalProductShowcase`

**Sem migração necessária** — o campo `display_type` é texto livre, basta usar o valor `'showcase'`.

### Arquivos
- **Novo**: `src/components/membros/PhysicalProductShowcase.tsx`
- **Editado**: `src/pages/AreaMembros.tsx` (seletor + badge)
- **Editado**: `src/pages/AreaMembrosPublica.tsx` (filtro + renderização)

