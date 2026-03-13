

## Problema

A tabela mostra uma linha por sessão individual, resultando em várias linhas repetidas para a mesma pessoa (ex: "Aparecida rosa pereira machado" aparece 4 vezes). O usuário quer ver **uma linha por pessoa** com dados consolidados.

## Solução

Refatorar o histórico para agrupar todas as sessões por telefone (usando a regra dos 8 dígitos finais) e mostrar **uma única linha por membro** com dados acumulados.

### Mudanças em `src/components/membros/MemberActivityTab.tsx`

1. **Criar estrutura `MemberSummary`** que agrupa sessões por pessoa:
   - Nome / telefone
   - Status: Online se qualquer sessão ativa, senão Offline
   - Última atividade: da sessão mais recente
   - Primeiro acesso (24h): `started_at` mais antigo
   - Último acesso: `started_at` ou `last_heartbeat_at` mais recente
   - Tempo total: soma das durações de todas as sessões
   - Total de acessos: contagem de sessões

2. **Agrupar sessões** usando os últimos 8 dígitos do telefone para unificar variações de formato

3. **Atualizar a tabela** com colunas:
   - Membro | Status | Última Atividade | Primeiro Acesso | Último Acesso | Tempo Total | Acessos

4. **Seção "Online"** também consolida por pessoa (uma entrada por membro online, mostrando atividade da sessão mais recente)

5. **Stats cards** permanecem iguais (já usam `uniqueVisitorsToday` corretamente)

