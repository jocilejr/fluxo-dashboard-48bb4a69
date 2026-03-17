

## Problema Identificado

A tabela `global_delivery_pixels` tem uma política RLS que **bloqueia leitura para usuários anônimos**:

```
Policy: "Users can view global pixels"
Condition: auth.uid() IS NOT NULL
```

A área de membros (`/membros/:phone`) é acessada por **usuários não autenticados** (role `anon`). Quando o código tenta buscar os pixels globais, a query retorna vazio. O código então sai na verificação `if (globalPixels.length === 0) return;` e nunca dispara os pixels.

Isso explica por que parou de funcionar — provavelmente uma migração recente alterou a política de acesso dessa tabela.

## Solução

**Migração SQL** — Criar uma política SELECT que permita leitura anônima dos pixels ativos:

```sql
CREATE POLICY "Anon can view active global pixels"
ON public.global_delivery_pixels
FOR SELECT
TO anon
USING (is_active = true);
```

Isso permitirá que a área de membros (acesso anônimo) consulte os pixels globais ativos e dispare os eventos de conversão normalmente.

**Nenhuma alteração de código** é necessária — apenas a política RLS.

