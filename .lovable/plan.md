

## Diagnóstico

A tabela `member_sessions` existe e tem 0 registros. Os tipos TypeScript incluem `member_sessions` corretamente, mas o hook usa `as any` desnecessariamente — isso pode estar mascarando erros silenciosos.

O problema principal: o insert no hook `useMemberSession` **engole erros silenciosamente**. Se o insert falha (por qualquer razão — ex.: problema de RLS com anon, erro de rede), `data` retorna `null`, e o hook simplesmente retorna sem criar sessão nem logar o erro.

Além disso, a página pública (`/membros/:phone`) usa o cliente Supabase com a chave anon (sem usuário autenticado). A RLS permite insert para `anon`, mas o hook faz o insert via SDK sem verificar o `error` retornado.

## Correções

### 1. Remover `as any` e adicionar tratamento de erro no hook
**Arquivo:** `src/hooks/useMemberSession.ts`
- Remover todos os `as any` — a tabela já existe nos types
- Logar `error` no `startSession` para diagnosticar falhas
- Logar `error` no heartbeat update
- Logar `error` no `updateActivity`

### 2. Adicionar console.log de diagnóstico temporário
Na função `startSession`:
```typescript
const { data, error } = await supabase
  .from("member_sessions")
  .insert({ ... })
  .select("id")
  .single();

if (error) {
  console.error("[MemberSession] Failed to create session:", error);
  return;
}
```

No heartbeat e updateActivity, mesma lógica de captura de erro.

### 3. Garantir que `sessionActive` fica `true`
Verificar que `loading` realmente vira `false` após o carregamento dos dados do membro. Se `loadMemberData` falhar, `loading` pode nunca mudar e `sessionActive` ficaria `false` para sempre.

**Arquivo:** `src/pages/AreaMembrosPublica.tsx` — verificar que o `finally` do `loadMemberData` seta `setLoading(false)`.

### Resumo de mudanças
| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMemberSession.ts` | Remover `as any`, adicionar captura de erro com `console.error` em insert, heartbeat e updateActivity |

Com isso, ao abrir a área de membros pública, veremos no console exatamente por que o insert está falhando (ou se está funcionando e o problema é outro).

