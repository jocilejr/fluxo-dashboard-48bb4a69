

# Corrigir Tempo Relativo e Status de Recuperacao em Tempo Real

## Problemas Identificados

### 1. Tempo relativo nao atualiza ("Agora" para sempre)
A funcao `formatRelativeTime` no `TransactionsTable.tsx` calcula o tempo relativo apenas quando o componente renderiza. Como nao ha nenhum mecanismo para forcar re-renderizacao periodica, o texto "Agora" permanece mesmo apos 16 minutos.

### 2. Badge de "contactado" nao atualiza sem F5
O hook `useTransactionRecoveryLogs` busca dados da tabela `evolution_message_log` mas:
- Usa `staleTime: 30000` e `refetchOnWindowFocus: false`
- Usa cache local (localStorage) que impede novas buscas para IDs ja cacheados
- Nao ha canal Realtime escutando mudancas na tabela `evolution_message_log`
- Apos enviar uma recuperacao, o cache local ja tem o ID, entao nunca rebusca do banco

## Solucao

### 1. Timer para atualizar tempo relativo
Adicionar um estado `tick` no `TransactionsTable.tsx` que incrementa a cada 60 segundos, forcando re-renderizacao e recalculo dos tempos relativos.

```text
TransactionsTable.tsx:
- Adicionar: const [tick, setTick] = useState(0)
- Adicionar: useEffect com setInterval de 60s para incrementar tick
- O React re-renderiza automaticamente, recalculando formatRelativeTime
```

### 2. Realtime para recovery logs
Adicionar um canal Realtime no `useTransactionRealtime.ts` escutando a tabela `evolution_message_log`. Quando uma mensagem de recuperacao e registrada, invalidar o cache de recovery logs e atualizar o cache local.

```text
useTransactionRealtime.ts:
- Adicionar segundo listener no mesmo canal para tabela evolution_message_log
- Ao receber INSERT/UPDATE: invalidar queryKey ['transaction-recovery-logs-db']
- Atualizar o localStorage cache para refletir o novo status
```

### 3. Corrigir cache agressivo de recovery logs
No `useTransactionRecoveryLogs.ts`, o filtro `idsNotInLocalCache` impede rebusca de IDs ja cacheados localmente. Precisamos:
- Invalidar o cache local quando recebemos evento realtime
- Ou adicionar uma funcao `invalidateRecoveryLog` que remove um ID do cache local

## Arquivos a Modificar

### `src/components/dashboard/TransactionsTable.tsx`
- Adicionar estado `tick` com `useState(0)`
- Adicionar `useEffect` com `setInterval` de 60 segundos
- Incluir `tick` como dependencia implícita (o state change ja forca re-render)

### `src/hooks/useTransactionRealtime.ts`
- Adicionar listener para `evolution_message_log` no mesmo canal
- Ao receber evento: chamar `queryClient.invalidateQueries({ queryKey: ['transaction-recovery-logs-db'] })`
- Limpar o cache localStorage dos recovery logs afetados

### `src/hooks/useTransactionRecoveryLogs.ts`
- Exportar funcao `invalidateLocalCache(transactionId)` para permitir limpeza externa
- Ou: reduzir `staleTime` e habilitar `refetchOnWindowFocus` para permitir atualizacoes mais frequentes
- Alternativa mais simples: ao invalidar via React Query, tambem limpar o localStorage cache do ID afetado

## Detalhes Tecnicos

### Timer de tick (TransactionsTable.tsx)
```text
const [tick, setTick] = useState(0);
useEffect(() => {
  const interval = setInterval(() => setTick(t => t + 1), 60000);
  return () => clearInterval(interval);
}, []);
```

### Realtime para evolution_message_log (useTransactionRealtime.ts)
```text
// Adicionar ao canal existente:
.on(
  "postgres_changes",
  { event: "*", schema: "public", table: "evolution_message_log" },
  (payload) => {
    // Invalidar cache de recovery logs
    queryClient.invalidateQueries({ queryKey: ['transaction-recovery-logs-db'] });
    // Limpar localStorage cache para forcar rebusca
  }
)
```

### Migracao SQL necessaria
```text
ALTER PUBLICATION supabase_realtime ADD TABLE public.evolution_message_log;
```
Isso habilita o Realtime para a tabela de logs de recuperacao.

### Ajuste no useTransactionRecoveryLogs.ts
```text
- Ao receber invalidacao, limpar localCacheLogs state para os IDs afetados
- Isso permite que o useQuery rebusque os dados atualizados do banco
```

