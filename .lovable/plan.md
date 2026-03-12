

## Diagnóstico

A tabela `member_sessions` existe corretamente com 0 registros. As políticas RLS estão corretas (anon pode INSERT e UPDATE). O hook `useMemberSession` tem error logging adequado.

**Causa raiz**: O tracking só funciona quando um membro acessa a página pública (`/membros/:phone`). É provável que desde o deploy nenhum membro tenha acessado a página, OU que os membros acessem via a URL publicada (`fluxo-dashboard.lovable.app`) e não via preview -- e o app precisa estar publicado com as últimas mudanças.

Porém, há um bug sutil que pode impedir o funcionamento mesmo com acessos reais: o hook `useMemberSession` depende de `active` mudar de `false` para `true`. Mas como React StrictMode pode executar effects duas vezes em dev, e o `cancelled` flag pode causar race conditions, preciso endurecer o hook.

## Plano de correção

### 1. Tornar o hook mais robusto e testável
**Arquivo**: `src/hooks/useMemberSession.ts`
- Adicionar um `console.log` logo no início do `useEffect` para confirmar que ele está sendo chamado: `console.log("[MemberSession] Effect triggered, active:", active, "phone:", normalizedPhone)`
- Garantir que o `cancelled` flag não bloqueia o fluxo em StrictMode

### 2. Adicionar botão de teste no admin
**Arquivo**: `src/components/membros/MemberActivityTab.tsx`
- Adicionar um botão "Simular sessão de teste" que faz um INSERT direto na tabela `member_sessions` com um telefone de teste, para validar que a tabela, RLS e UI estão funcionando
- Isso permite ao admin verificar o sistema sem depender de um membro real

### 3. Publicar o app
- O app precisa ser publicado para que as mudanças cheguem à URL que os membros reais acessam

### Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMemberSession.ts` | Logs de diagnóstico no effect |
| `src/components/membros/MemberActivityTab.tsx` | Botão "Simular sessão de teste" para validação |

