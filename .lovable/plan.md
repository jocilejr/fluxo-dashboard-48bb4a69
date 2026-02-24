

# Corrigir Atualizacao em Tempo Real das Transacoes

## Problema Identificado

O sistema de realtime esta **funcionando no backend** (os logs confirmam que o canal esta "SUBSCRIBED" e os webhooks estao criando transacoes). Porem, ha dois problemas principais:

1. **Hook duplicado**: O `useTransactions()` e chamado em multiplos lugares simultaneamente (AppLayout, Dashboard, Transacoes), criando **canais realtime duplicados** que competem entre si. Os logs confirmam: aparecem duas mensagens "Setting up subscription..." e dois "SUBSCRIBED".

2. **Refetch muito pesado**: Cada evento realtime dispara um `refetch()` que busca **todas as 4.383 transacoes** em lotes de 1.000 (5 requisicoes sequenciais). Isso torna a atualizacao muito lenta e pode parecer que nao funciona.

## Solucao

### 1. Separar o realtime do hook de dados

Criar um hook dedicado `useTransactionRealtime` que sera chamado **apenas uma vez** no `AppLayout`. Este hook:
- Gerencia o canal Supabase Realtime (unico)
- Dispara notificacoes (popup, browser notification, activity log)
- Invalida o cache do React Query para que todos os consumidores atualizem

### 2. Simplificar o `useTransactions` 

Remover toda a logica de realtime e notificacoes do `useTransactions`. Ele passa a ser apenas um hook de dados (query + stats). Isso evita canais duplicados.

### 3. Otimizar o refetch

Em vez de buscar todas as 4.383+ transacoes novamente, usar `queryClient.invalidateQueries` para invalidar o cache, e adicionar a nova transacao diretamente no cache via `queryClient.setQueryData` (optimistic update).

## Arquivos a Modificar

### `src/hooks/useTransactionRealtime.ts` (novo)
- Hook dedicado ao canal Realtime
- Chamado apenas no AppLayout
- Ao receber evento: atualiza cache do React Query e gera notificacoes
- Canal unico com ID estavel

### `src/hooks/useTransactions.ts` (modificar)
- Remover toda logica de Realtime (canal, subscribe, notificacoes)
- Manter apenas: `useQuery` para buscar dados + calculo de `stats`
- Exportar apenas `transactions`, `stats`, `isLoading`, `refetch`

### `src/components/AppLayout.tsx` (modificar)  
- Importar e usar o novo `useTransactionRealtime()`
- Obter `notifications` e `dismissAllNotifications` do hook de realtime
- Manter `useTransactions()` apenas para `transactions` (dados para contagem)

### `src/pages/Dashboard.tsx` e `src/pages/Transacoes.tsx`
- Nenhuma mudanca necessaria - continuam chamando `useTransactions()` normalmente
- Atualizacao automatica via invalidacao do cache React Query

## Detalhes Tecnicos

O novo hook `useTransactionRealtime` usara:

```text
1. Um unico canal Supabase com ID fixo (sem Date.now())
2. Ao receber INSERT/UPDATE:
   - queryClient.setQueryData para adicionar/atualizar a transacao no cache imediatamente
   - queryClient.invalidateQueries com refetchType: 'none' para marcar como stale
   - Gerar notificacao visual
3. Notificacoes de browser via Service Worker (existente)
4. Activity log (existente)
```

Isso garante que a UI atualiza **instantaneamente** sem precisar re-buscar 4.383+ registros.

