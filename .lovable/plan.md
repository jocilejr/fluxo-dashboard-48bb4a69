

## 4 Balões na Copy da Oferta + Extração Automática de Conhecimento

### Resumo

Reestruturar o chat da oferta para 4 balões com intervalo de 10 segundos entre cada um, incluindo imagem do produto no 3° balão. Implementar extração automática de conhecimento quando um material é adicionado ao produto.

### Estrutura dos 4 Balões

1. **Balão 1**: Informar que ela já adquiriu [produtos que possui]
2. **Balão 2**: Resumo do que ela já aprendeu + como o novo material complementa
3. **Balão 3**: Imagem de capa do **produto** (não da oferta) — `member_cover_image` ou `page_logo` do `delivery_products`
4. **Balão 4**: O que contém dentro do material (listar módulos/materiais específicos)

### Alterações

**1. Edge function `member-offer-pitch`**
- Alterar o prompt para gerar **3 mensagens de texto** (balões 1, 2 e 4) — o balão 3 é a imagem, montada no frontend
- Balão 1: mencionar os produtos que a pessoa já possui
- Balão 2: usar o `knowledgeContext` para resumir o que ela aprendeu e fazer a ponte com o novo material
- Balão 4: listar especificamente o conteúdo dentro do novo material
- Retornar `{ messages: [msg1, msg2, msg4] }` (3 strings)
- Também retornar `productImageUrl` buscando do `delivery_products` via `product_id` da oferta (campo `member_cover_image` ou `page_logo`)

**2. Frontend `LockedOfferCard.tsx`**
- Receber os 3 textos + URL da imagem do produto
- Montar array de 4 itens: `[texto1, texto2, {type: "image", url}, texto4]`
- Alterar o timer de revelação de balões de 400ms/900ms para **10 segundos** entre cada balão
- No render, detectar se o item é imagem e renderizar como `<img>` em vez de texto dentro do balão
- Aumentar `max-h` do scroll area para comportar os 4 balões + imagem

**3. Extração automática de conhecimento ao adicionar material**
- Em `ContentManagement.tsx`, no `onSuccess` do `addMatMutation`, disparar automaticamente a edge function `member-extract-knowledge` com o `product_id`
- Isso garante que o resumo é atualizado sempre que um novo arquivo é adicionado, sem ação manual do admin
- Chamar de forma assíncrona (fire-and-forget) para não bloquear a UI

### Arquivos

- **Editado**: `supabase/functions/member-offer-pitch/index.ts` — prompt para 3 textos + buscar imagem do produto
- **Editado**: `src/components/membros/LockedOfferCard.tsx` — 4 balões com timer de 10s, suporte a imagem no 3° balão
- **Editado**: `src/components/membros/ContentManagement.tsx` — chamar `member-extract-knowledge` automaticamente ao adicionar material

