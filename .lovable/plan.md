

## Problema

O query key `"delivery-products-list"` é compartilhado entre 3 arquivos, mas com selects diferentes:

- `ContentManagement.tsx`: `select("id, name, member_cover_image, page_logo")`
- `AreaMembros.tsx`: `select("id, name")` — **sem os campos de imagem**
- `AccessesTab.tsx`: outro select diferente

O React Query cacheia pelo key. Se `AreaMembros.tsx` carrega primeiro, os dados ficam no cache **sem** `member_cover_image`, e o `ContentManagement.tsx` usa esse cache sem imagem.

## Solução

Dar query keys únicos para cada componente que usa selects diferentes:

1. **`src/pages/AreaMembros.tsx`**: Mudar key para `"delivery-products-names"` (já que só precisa de id e name)
2. **`src/components/membros/ContentManagement.tsx`**: Mudar key para `"delivery-products-content"` (precisa de imagens)
3. **`src/components/entrega/AccessesTab.tsx`**: Mudar key para `"delivery-products-accesses"` (tem seu próprio select)

Isso garante que cada componente mantenha seu cache independente com os campos corretos.

