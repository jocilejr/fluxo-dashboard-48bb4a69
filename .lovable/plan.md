

## Extrair e Armazenar Conhecimento dos PDFs para Contexto da Copy

### Ideia

Criar uma tabela `product_knowledge_summaries` que armazena resumos do conteúdo de cada produto (extraídos via IA dos PDFs). Na hora de gerar a copy da oferta, a edge function consulta os resumos dos produtos que a pessoa **já possui** para personalizar a primeira mensagem com base no conhecimento que ela já adquiriu, criando uma ponte natural para a oferta.

### Alterações no banco

**Nova tabela `product_knowledge_summaries`:**
- `id` (uuid, PK)
- `product_id` (uuid, referência ao produto)
- `summary` (text) — resumo do conteúdo/conhecimento do produto
- `key_topics` (text[]) — tópicos principais extraídos
- `created_at`, `updated_at`
- RLS: leitura pública (anon+authenticated), escrita apenas admin/service role

### Nova edge function `member-extract-knowledge`

- Recebe `{ product_id }`
- Busca todos os materiais PDF do produto na tabela `member_product_materials`
- Para cada PDF, faz download do `content_url` do storage
- Envia o conteúdo (ou os títulos/descrições se o PDF for muito grande) para a IA (Lovable AI Gateway) pedindo um resumo dos ensinamentos principais
- Salva o resultado em `product_knowledge_summaries`
- Pode ser chamada manualmente pelo admin ou automaticamente ao importar PDFs

### Botão no admin (`AreaMembros.tsx`)

- Adicionar um botão "Gerar resumo de conhecimento" na seção de cada produto
- Ao clicar, chama a edge function `member-extract-knowledge`
- Mostra loading e feedback de sucesso

### Atualização da edge function `member-offer-pitch`

- Antes de gerar a copy, buscar os `product_knowledge_summaries` dos produtos que a pessoa já possui (`ownedProductNames` → buscar por nome ou IDs)
- Incluir no prompt do sistema uma seção "CONHECIMENTO QUE A PESSOA JÁ ADQUIRIU" com os resumos e tópicos
- Ajustar as instruções da primeira mensagem: em vez de apenas listar os nomes dos produtos, a IA deve **referenciar o que a pessoa aprendeu** (ex: "Você já estudou sobre oração intercessora e adoração...") para criar contexto e introduzir a oferta naturalmente

### Atualização do `LockedOfferCard.tsx`

- Passar os IDs dos produtos que a pessoa possui (além dos nomes) para a edge function
- A edge function faz a consulta dos resumos internamente

### Arquivos

- **Migração SQL**: criar tabela `product_knowledge_summaries`
- **Nova edge function**: `supabase/functions/member-extract-knowledge/index.ts`
- **Editado**: `supabase/functions/member-offer-pitch/index.ts` (consultar resumos e enriquecer prompt)
- **Editado**: `src/pages/AreaMembros.tsx` (botão para gerar resumo)
- **Editado**: `src/components/membros/LockedOfferCard.tsx` (passar IDs dos produtos)

