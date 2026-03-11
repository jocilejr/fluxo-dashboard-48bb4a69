

## Melhorar Área de Membros Pública: Layout, Navegação e Mensagem IA Personalizada

### Problemas Atuais
1. Materiais ficam escondidos dentro de accordions (difícil ver todos de uma vez)
2. Mensagem de boas-vindas é genérica/estática
3. Produto mais recente não aparece no topo
4. Layout não é clean o suficiente

### Solução

**1. Mensagem personalizada por IA (edge function)**
- Criar edge function `member-greeting` que recebe: nome do cliente, lista de produtos com materiais, e gera uma frase curta e dinâmica via Lovable AI
- A frase será sobre o progresso do membro (ex: "Você já explorou as orações de Santo Antônio? Que tal começar a Novena hoje?")
- Cachear no `localStorage` por 24h para não chamar a IA toda vez
- Exibir como um card sutil no topo, abaixo do header

**2. Layout redesenhado — materiais visíveis diretamente**
- Produto mais recente (`granted_at` mais recente) aparece primeiro, já expandido
- Dentro de cada produto, mostrar TODOS os materiais como cards visuais em grid (não mais escondidos em categorias)
- Categorias viram separadores visuais (label + linha), não botões que escondem conteúdo
- MaterialCard fica mais visual: ícone grande + título + tipo (badge)

**3. Ordenação por recência**
- Ordenar `products` por `granted_at DESC` — o mais recente fica no topo
- O primeiro produto já vem expandido automaticamente

### Arquivos

**Novo:**
- `supabase/functions/member-greeting/index.ts` — Edge function que chama Lovable AI para gerar saudação personalizada curta

**Editados:**
- `src/pages/AreaMembrosPublica.tsx` — Novo layout: produto recente no topo expandido, mensagem IA, materiais em grid flat
- `src/components/membros/ProductContentViewer.tsx` — Mostrar materiais em grid direto com categorias como separadores (não como navegação drill-down)
- `src/components/membros/MaterialCard.tsx` — Layout mais visual e limpo

### Edge Function `member-greeting`

Recebe `{ firstName, products: [{ name, materialCount }] }`, retorna `{ message: "..." }` via Lovable AI com prompt para gerar frase curta, motivacional, personalizada mencionando os produtos do membro.

### Fluxo Visual

```text
┌──────────────────────────────────────┐
│ Header com logo + saudação           │
├──────────────────────────────────────┤
│ 💬 "Maria, você já viu as novenas   │
│ de Santo Antônio? Continue sua       │
│ jornada de fé!" (gerado por IA)      │
├──────────────────────────────────────┤
│ 📖 Versículo do Dia                  │
├──────────────────────────────────────┤
│ ⭐ Santo Antônio (mais recente)      │
│  ── Orações ──                       │
│  [Oração 1] [Oração 2] [Oração 3]   │
│  ── Novenas ──                       │
│  [Novena 1] [Novena 2]              │
├──────────────────────────────────────┤
│ 📚 Produto Anterior (colapsado)      │
├──────────────────────────────────────┤
│ 🔒 Ofertas Exclusivas               │
└──────────────────────────────────────┘
```

Nenhuma mudança de banco necessária. Apenas a query de `member_products` precisa incluir `granted_at` na ordenação.

