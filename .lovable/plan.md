

## Problema

A página de Recuperação chama `useTransactions()` sem parâmetros, que após a correção de estabilidade agora retorna apenas transações de **hoje**. Mas a recuperação precisa de **todos os boletos não pagos** independente da data de criação (boletos criados dias/semanas atrás que casam com regras de recuperação hoje).

## Correção

### `src/pages/Recuperacao.tsx`
- Passar um range de datas amplo para `useTransactions()` (ex: últimos 90 dias) para cobrir todos os boletos pendentes que podem casar com regras de recuperação.
- Alternativa melhor: criar uma query dedicada no `useBoletoRecovery` que busca boletos não pagos diretamente do banco, sem depender do `useTransactions` e seu filtro de data.

### Abordagem escolhida: Query dedicada
- Modificar `src/hooks/useBoletoRecovery.ts` para buscar boletos não pagos diretamente do banco (query própria com filtro `type=boleto` e `status NOT IN (pago, cancelado, expirado)`), eliminando a dependência de receber `transactions` como prop.
- Atualizar `src/pages/Recuperacao.tsx` para não precisar mais passar transactions.
- Atualizar `src/components/dashboard/BoletoRecoveryDashboard.tsx` para usar o hook diretamente.

Isso resolve o problema sem afetar a otimização de estabilidade do `useTransactions`.

### Arquivos
- `src/hooks/useBoletoRecovery.ts` — adicionar query própria de boletos não pagos
- `src/pages/Recuperacao.tsx` — simplificar, remover useTransactions
- `src/components/dashboard/BoletoRecoveryDashboard.tsx` — adaptar para não receber transactions como prop

