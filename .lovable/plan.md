

## Sistema de Pixel Frames na Área de Membros

### Conceito

Quando um produto é entregue (acesso liberado via `member_products`), o sistema cria um "pixel frame" pendente. Quando o membro acessa a área de membros (`/membros/:phone`), os frames pendentes são disparados automaticamente (1x cada) e marcados como "fired". Cada frame carrega o valor e nome do produto para diferenciar os eventos.

### Mudanças

**1. Nova tabela `member_pixel_frames` (migração SQL)**

```sql
CREATE TABLE public.member_pixel_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  product_id uuid REFERENCES delivery_products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  product_value numeric NOT NULL DEFAULT 0,
  fired boolean NOT NULL DEFAULT false,
  fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
- RLS: leitura e escrita pública (anon+authenticated) para funcionar na area de membros publica
- Index em `(normalized_phone, fired)` para queries eficientes

**2. Criar pixel frame automaticamente ao inserir em `member_products`**

Adicionar um trigger `after insert` em `member_products` que:
- Busca o `delivery_products.name` e `delivery_products.value` do produto
- Insere um registro em `member_pixel_frames` com `fired = false`

Isso garante que toda entrega de produto gera automaticamente um frame de pixel pendente.

**3. Disparar pixels pendentes em `AreaMembrosPublica.tsx`**

No carregamento da página:
- Buscar `member_pixel_frames` onde `normalized_phone` IN variações e `fired = false`
- Buscar os pixels globais de `global_delivery_pixels` (mesmos usados na Entrega)
- Para cada frame pendente, disparar todos os pixels configurados com o `product_value` e `product_name` daquele frame
- Após disparo, marcar `fired = true` e `fired_at = now()`
- Reutilizar as funções de disparo de pixel já existentes em `EntregaPublica.tsx` extraindo-as para um utilitário compartilhado

**4. Extrair lógica de pixel para `src/lib/pixelFiring.ts`**

Mover as funções `loadMetaPixel`, `loadTikTokPixel`, `loadGoogleTag`, `loadPinterestTag`, `loadTaboolaPixel` e `firePixels` de `EntregaPublica.tsx` para um arquivo compartilhado. Ambas as páginas importarão dele.

### Arquivos

- **Migração SQL**: criar tabela `member_pixel_frames` + trigger em `member_products`
- **Novo**: `src/lib/pixelFiring.ts` — funções de disparo de pixel extraídas
- **Editado**: `src/pages/EntregaPublica.tsx` — importar de `pixelFiring.ts`
- **Editado**: `src/pages/AreaMembrosPublica.tsx` — carregar frames pendentes, disparar pixels, marcar como fired

