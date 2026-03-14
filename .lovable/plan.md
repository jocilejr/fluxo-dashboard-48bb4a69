

## Plano: Adicionar preview da imagem de capa nos cards de produto (admin)

### Problema
Os cards de produto na aba "Conteúdo" mostram apenas um ícone genérico e o nome. O usuário quer ver a imagem de capa (`member_cover_image` ou `page_logo`) como preview, similar ao que o membro vê na página pública.

### Mudanças

**Arquivo:** `src/components/membros/ContentManagement.tsx`

1. **Alterar a query de produtos** para incluir `member_cover_image` e `page_logo`:
   - De: `select("id, name")`
   - Para: `select("id, name, member_cover_image, page_logo")`

2. **Atualizar o card** para exibir a imagem de capa como banner no topo:
   - Se `member_cover_image` ou `page_logo` existir, mostrar como imagem de fundo/banner (estilo horizontal, ~100px de altura) acima do nome
   - Caso contrário, manter o ícone genérico atual como fallback
   - Manter o estilo visual consistente com os cards da página pública (imagem com overlay escuro e nome em cima)

