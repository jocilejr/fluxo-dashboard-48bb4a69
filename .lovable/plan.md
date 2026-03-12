

## Rotação Estratégica de Ofertas

### Problema
Atualmente, o membro sempre vê as mesmas ofertas na mesma ordem. Se não teve interesse em 1-2 acessos, continua vendo a mesma oferta sem alteração.

### Solução

Criar um sistema de rotação de ofertas baseado em impressões e cliques, usando `localStorage` para rastrear visualizações e uma lógica de priorização.

**1. Tabela de rastreamento (nova migração)**

Criar tabela `member_offer_impressions`:
- `id` (uuid, PK)
- `normalized_phone` (text, NOT NULL)
- `offer_id` (uuid, FK → member_area_offers)
- `impression_count` (int, default 0) — quantas vezes a oferta apareceu
- `clicked` (boolean, default false) — se o membro já clicou
- `last_shown_at` (timestamptz)
- `created_at` (timestamptz, default now())
- Unique constraint em `(normalized_phone, offer_id)`
- RLS: leitura e escrita pública (anon+authenticated) pois a área de membros é pública

**2. Lógica de rotação em `AreaMembrosPublica.tsx`**

No `filteredOffers`, após filtrar ofertas de produtos já possuídos:
- Carregar impressões do membro da tabela `member_offer_impressions`
- Ofertas com `impression_count >= 2` e `clicked = false` são depriorizadas (vão para o final da lista ou são substituídas por outras)
- Se todas as ofertas de um tipo (card, bottom_page) já foram vistas 2x sem clique, reiniciar o ciclo (resetar contadores)
- Ao renderizar uma oferta, fazer upsert incrementando `impression_count`

**3. Registro de clique em `LockedOfferCard.tsx`**

Quando o membro clica para abrir o diálogo de uma oferta (`handleOpen`):
- Fazer upsert em `member_offer_impressions` marcando `clicked = true`
- Ofertas clicadas mantêm prioridade (a pessoa demonstrou interesse)

**4. Ordem de exibição**

Prioridade (maior para menor):
1. Ofertas nunca vistas (`impression_count = 0`)
2. Ofertas vistas 1x sem clique
3. Ofertas clicadas (a pessoa já se interessou, pode converter)
4. Ofertas vistas 2x+ sem clique (menor prioridade)

### Arquivos

- **Migração SQL**: criar tabela `member_offer_impressions` com RLS
- **Editado**: `src/pages/AreaMembrosPublica.tsx` — carregar impressões, reordenar ofertas, registrar impressão
- **Editado**: `src/components/membros/LockedOfferCard.tsx` — registrar clique ao abrir diálogo
- **Editado**: `src/components/membros/BottomPageOffer.tsx` — registrar clique (se aplicável)

