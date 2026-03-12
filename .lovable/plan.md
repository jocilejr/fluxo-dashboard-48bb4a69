

## Problema

Números como `55988011206` e `5547988011206` não são unificados pelo `generatePhoneVariations` porque o sistema interpreta DDDs diferentes (55 vs 47). Porém, os 8 últimos dígitos são iguais (`88011206`), indicando que é a mesma pessoa.

## Solução

Adicionar uma segunda camada de agrupamento no `mergeCustomerRecords`: após o agrupamento por variações (que já funciona para casos com/sem 9º dígito), fazer um segundo passe comparando os **8 últimos dígitos** de cada telefone. Se dois clientes compartilham os mesmos 8 últimos dígitos, eles são mesclados.

### Arquivo: `src/hooks/useCustomers.ts` — função `mergeCustomerRecords`

Após o loop atual de union-find por variações (linhas 55-83), adicionar um segundo passe:

1. Para cada grupo, extrair os 8 últimos dígitos do `normalized_phone` do primeiro membro
2. Manter um `Map<string, number>` de `últimos8dígitos → índice do grupo`
3. Se outro grupo tiver os mesmos 8 últimos dígitos, fundir os dois grupos

A agregação de dados (linhas 85-118) permanece igual — apenas o agrupamento ganha essa regra adicional.

### Impacto

- `55988011206` (últimos 8: `88011206`) e `5547988011206` (últimos 8: `88011206`) serão unificados
- Sem alteração no banco de dados
- Sem risco de quebrar números existentes — a regra dos 8 últimos dígitos é suficientemente específica para evitar falsos positivos em números brasileiros

