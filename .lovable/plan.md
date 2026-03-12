

## Problema

Ao liberar acesso na Área de Membros, o sistema insere um novo registro em `member_products` usando o telefone exatamente como digitado. Se o mesmo número já existe em formato diferente (ex: com/sem 55), cria duplicata.

## Solução

Aplicar a regra dos 8 últimos dígitos em **3 pontos de inserção** de `member_products`:

### 1. `src/components/entrega/LinkGenerator.tsx` — `handleGenerate` (linha ~71)

Antes do upsert, buscar se já existe um `member_products` com o mesmo `product_id` cujos 8 últimos dígitos do `normalized_phone` coincidam:

```typescript
const last8 = normalizedPhone.slice(-8);
const { data: existing } = await supabase
  .from("member_products")
  .select("id, normalized_phone")
  .eq("product_id", product.id)
  .eq("is_active", true);

const match = existing?.find(mp => mp.normalized_phone.slice(-8) === last8);

if (match) {
  // Já existe acesso — usar o normalized_phone existente para o link
  // Não inserir duplicata
} else {
  // Inserir novo acesso normalmente
}
```

O link gerado usará o `normalized_phone` do registro existente (se houver match), garantindo que o URL aponte para o perfil correto.

### 2. `src/pages/AreaMembros.tsx` — `addMutation` (linha ~96)

Mesma lógica: antes do insert, verificar se já existe registro com os mesmos 8 últimos dígitos para aquele produto. Se existir, mostrar toast informativo em vez de criar duplicata.

### 3. `src/pages/AreaMembros.tsx` — `groupedByPhone` (linha ~85)

Agrupar registros por sufixo de 8 dígitos (mesma lógica já aplicada em `useCustomers.ts`), para que a lista de membros não mostre o mesmo cliente duas vezes.

### 4. `src/pages/AreaMembrosPublica.tsx` — busca de produtos (linha ~107)

Já usa `generatePhoneVariations` + `.in()`. Adicionar fallback por últimos 8 dígitos: se a busca por variações retornar vazio, fazer segunda query filtrando por sufixo.

### 5. Limpeza de duplicatas existentes (SQL via migration)

Script para consolidar registros duplicados em `member_products` onde os 8 últimos dígitos coincidem para o mesmo `product_id` — manter o mais antigo e deletar os demais.

