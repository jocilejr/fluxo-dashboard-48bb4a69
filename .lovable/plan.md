

## Problema

A duração das sessões está mostrando 1h+ porque:

1. O `endSession` usa `fetch` com `keepalive` para setar `ended_at`, mas esse PATCH provavelmente falha silenciosamente (o anon user pode não ter permissão de UPDATE via REST direto, ou o `beforeunload` não completa).
2. `SessionDuration` calcula `new Date() - started_at` quando `ended_at` é `null`. Sessões offline sem `ended_at` mostram duração crescendo infinitamente.

## Correções

### 1. Corrigir cálculo de duração para sessões offline
**Arquivo:** `src/components/membros/MemberActivityTab.tsx`

- Alterar `SessionDuration` para receber `lastHeartbeatAt` como prop
- Quando `endedAt` é null E a sessão está offline (heartbeat > 90s), usar `lastHeartbeatAt` como fim em vez de `now()`
- Isso garante que sessões "abandonadas" mostrem a duração real de uso

### 2. Adicionar limpeza automática de sessões órfãs
**Arquivo:** `src/components/membros/MemberActivityTab.tsx`

- Na query de sessões, após carregar, marcar automaticamente sessões com heartbeat > 5min e sem `ended_at` como encerradas (update `ended_at = last_heartbeat_at`)
- Isso corrige sessões que nunca receberam o `ended_at` por falha no `beforeunload`

### 3. Passar `last_heartbeat_at` no componente de duração
Atualizar as chamadas de `SessionDuration` na tabela e na seção "Online" para incluir o novo prop.

| Arquivo | Mudança |
|---------|---------|
| `src/components/membros/MemberActivityTab.tsx` | Corrigir cálculo de duração + limpeza de sessões órfãs |

