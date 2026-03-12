
Objetivo: corrigir o bug “estou online mas não aparece no sistema” sem abrir leitura pública de dados sensíveis.

1) Diagnóstico confirmado
- No banco, existe apenas 1 sessão (a sessão simulada), e nenhuma sessão real de membro.
- Isso indica que o painel admin está funcional para leitura autenticada, mas o tracking da página pública não está criando sessão.
- Causa mais provável: no `useMemberSession`, o insert usa `.insert(...).select("id").single()`.  
  Como o acesso público é anônimo e `member_sessions` não tem `SELECT` para anon (correto por privacidade), o retorno do `id` bloqueia/falha o fluxo.

2) Correção principal (sem relaxar segurança)
- Arquivo: `src/hooks/useMemberSession.ts`
- Trocar criação de sessão para:
  - gerar `sessionId` no cliente (`crypto.randomUUID()`),
  - inserir com `id` explícito,
  - **sem** `.select()` (sem depender de policy de leitura anon).
- Manter heartbeat/update por `id` gerado localmente.
- Adicionar retry curto de criação de sessão (ex.: 5s) em caso de erro temporário de rede.
- Melhorar logs para distinguir:
  - falha no insert inicial,
  - falha no heartbeat,
  - falha no encerramento.

3) Melhorar observabilidade no painel admin
- Arquivo: `src/components/membros/MemberActivityTab.tsx`
- Parar de engolir erro no query de sessões:
  - se `select` falhar, logar erro e mostrar feedback visual (ex.: toast/alert de “erro ao carregar sessões”).
- Remover cast `as any` nessa query para evitar mascaramento de erro de tipagem/consulta.

4) Garantia de atualização no mobile (PWA)
- Arquivo: `src/sw.ts`
- Incrementar `CACHE_VERSION` para forçar atualização do service worker e reduzir chance de cliente mobile rodando bundle antigo sem tracking.

5) Segurança (manter)
- Não adicionar `SELECT` para anon em `member_sessions` (evita exposição de telefones/sessões).
- Não alterar política de leitura autenticada do admin.

Detalhes técnicos
- Fluxo novo de sessão pública:
```text
/membros/:phone abre
→ gerar sessionId local
→ INSERT member_sessions { id: sessionId, ... } (sem .select)
→ heartbeat a cada 30s via UPDATE where id=sessionId
→ beforeunload/pagehide: ended_at
```
- Sem migration obrigatória (a tabela/policies já existem); ajuste é de frontend e PWA cache-bust.

Validação (E2E)
1. Abrir `/area-membros` (aba Atividade) no desktop autenticado.
2. Abrir `/membros/:phone` em aba anônima/celular.
3. Confirmar:
   - “Online agora” incrementa em até ~30s,
   - atividade muda ao abrir produto/PDF/vídeo.
4. Fechar aba pública e validar toast/queda para offline em até ~90s.
5. Conferir no banco: nova linha em `member_sessions` para o telefone real.
