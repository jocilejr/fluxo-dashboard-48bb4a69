

## Problema

Boletos criados em dias anteriores e pagos hoje não aparecem na aba "Aprovados" quando o filtro é "Hoje". Isso acontece porque:

1. O hook `useTransactions` faz a query ao banco filtrando por `created_at` (data de criação)
2. A tabela de transações tenta filtrar por `paid_at` para pagos, mas o registro nunca chega do banco

## Solução

Modificar o `useTransactions` para que, ao buscar transações, inclua também registros cujo `paid_at` esteja dentro do período selecionado. Isso garante que boletos criados em dias anteriores mas pagos no período filtrado apareçam corretamente.

### Alteração em `src/hooks/useTransactions.ts`

Modificar a query para usar um filtro OR: trazer transações cujo `created_at` OU `paid_at` estejam no período. Usando a sintaxe do Supabase, será feito com `.or()`:

```
.or(`created_at.gte.${start},paid_at.gte.${start}`)
```

Na prática, a query fará duas buscas combinadas:
- Transações criadas no período (comportamento atual)
- Transações pagas no período (novo - captura boletos de dias anteriores pagos hoje)

A deduplicação acontece automaticamente pelo banco.

### Impacto

- A aba "Aprovados" passará a mostrar corretamente boletos pagos no dia, independentemente da data de criação
- Nenhuma mudança visual - apenas a consulta de dados será mais abrangente
- O filtro de data da tabela já usa `paid_at` para transações pagas, então a exibição final não muda

