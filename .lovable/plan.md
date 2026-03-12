## Problema

A função `mergeCustomerRecords` agrupa clientes usando `normalizePhoneForMatching` como chave. Essa função não unifica variações do mesmo número (ex: `5589981340810` vs `558981340810`), criando registros duplicados na aba Clientes.

## Solução

Substituir o agrupamento por chave simples por um agrupamento baseado em **variações de telefone**, usando a função `generatePhoneVariations` que já existe no projeto.

### Arquivo: `src/hooks/useCustomers.ts` — função `mergeCustomerRecords` (linhas 50-99)

Trocar a lógica atual por um algoritmo de union-find:

1. Para cada cliente, gerar todas as variações com `generatePhoneVariations(customer.normalized_phone)`
2. Manter um `Map<string, number>` que mapeia qualquer variação para um índice de grupo
3. Se alguma variação já existe no mapa, juntar o cliente ao grupo existente; senão, criar grupo novo
4. Agregar os totais da mesma forma que hoje (soma de transações, valores, etc.)

A lógica é essencialmente a mesma que já existe em `groupByNormalizedPhone` no `phoneNormalization.ts`, mas adaptada para objetos `Customer[]`.

### Impacto

- Clientes com o mesmo telefone em formatos diferentes serão unificados em um único card
- Nenhuma alteração no banco de dados — os telefones originais continuam intactos
- A função `normalizePhoneForMatching` continua existindo para outros usos, sem modificação  
  
Faça uma busca em números disponíveis na tabela e veja se existem duplicadas. caso haja duplicata, Reúna as informações em apenas 1 contato.