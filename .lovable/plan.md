

## Problema

Números que começam com `0` (ex: `018988110401`) ficam com DDD inválido após normalização. Solução simples: se o número começa com `0`, remove o primeiro `0`.

## Plano

### 1. Migração SQL — atualizar `normalize_phone`

Alterar a função para, após remover não-dígitos, remover um `0` inicial se existir. Depois fazer backfill nas 3 tabelas.

```sql
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(phone, '[^0-9]', '', 'g');
  -- Remove leading zero if present
  IF left(digits, 1) = '0' THEN
    digits := substring(digits from 2);
  END IF;
  RETURN digits;
END;
$function$;

-- Backfill
UPDATE customers SET normalized_phone = normalize_phone(display_phone) WHERE display_phone IS NOT NULL;
UPDATE transactions SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL;
UPDATE abandoned_events SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL;
```

### 2. Frontend — `src/lib/phoneNormalization.ts`

Em `normalizePhoneForMatching` e `generatePhoneVariations`, após `replace(/\D/g, '')`, adicionar:
```ts
if (digits.startsWith('0')) digits = digits.slice(1);
```

Remover a lógica existente nas linhas 20-23 que já tentava fazer algo parecido (mas só funcionava com `55` na frente).

### 3. Edge functions — todos os pontos de normalização

Nos arquivos que fazem `phone.replace(/\D/g, '')`, adicionar a mesma linha logo depois:
- `webhook-receiver/index.ts` (linha 34)
- `send-external-message/index.ts` (linha 88)
- `webhook-abandoned/index.ts` (linha 30)
- `auto-recovery/index.ts` (linhas 397, 726, 851, 905)
- `delivery-access/index.ts` (linha 29)
- `external-messaging-webhook/index.ts` (linhas 75, 119, 255, 454, 580, 624)
- `validate-external-number/index.ts` (linha 51)
- `sync-external-data/index.ts` (linha 121)

Padrão simples em cada ponto:
```ts
let digits = phone.replace(/\D/g, '');
if (digits.startsWith('0')) digits = digits.slice(1);
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | `normalize_phone` remove `0` inicial + backfill |
| `src/lib/phoneNormalization.ts` | Adiciona remoção de `0` inicial nas 2 funções |
| 8+ edge functions | Adiciona `if (startsWith('0')) slice(1)` após cada normalização |

