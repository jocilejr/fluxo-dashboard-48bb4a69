
## Diagnóstico atualizado (com base no código atual)

Identifiquei **4 causas concretas** para o problema continuar mesmo após as últimas mudanças:

1. **Chave de cache inconsistente das transações**
   - O hook de dados usa `queryKey: ["transactions", options?.startDate?.toISOString(), options?.endDate?.toISOString()]`.
   - O hook de realtime atualiza `["transactions"]` (chave diferente).
   - Resultado: o evento realtime chega, mas a lista visível não recebe o update otimista.

2. **Cache de status de recuperação fica preso em memória**
   - `useTransactionRecoveryLogs` inicializa `localCacheLogs` com localStorage e depois só busca IDs fora desse cache.
   - Quando o evento realtime limpa apenas localStorage, o estado React (`localCacheLogs`) continua com dado antigo.
   - Resultado: badge/status não muda até recarregar página.

3. **Badge de “contactado” no fluxo rápido não invalida a query do contador**
   - `BoletoQuickRecovery.registerClick()` grava em `boleto_recovery_contacts`, mas não invalida `["boleto-recovery-count", transaction.id]`.
   - Resultado: ícone/contador pode atualizar só após F5.

4. **Realtime está só no layout desktop**
   - `useTransactionRealtime()` está no `AppLayout`, mas não no `MobileLayout`.
   - Se estiver em viewport mobile, não há assinatura realtime global.
   - Resultado: no mobile, atualização em tempo real pode não acontecer.

---

## Implementação proposta

### 1) Unificar a estratégia de cache de transações para o realtime funcionar de verdade
- Criar helper de chave em `useTransactions` (ex.: `getTransactionsQueryKey(options)`).
- Padronizar:
  - `["transactions"]` quando não há filtro.
  - chave composta só quando realmente houver filtros.
- No hook realtime, trocar `setQueryData(["transactions"], ...)` por `setQueriesData({ queryKey: ["transactions"] }, updater)` para atualizar **todas** as variações da query.
- Ajustar também leitura inicial (`getQueryData`) para buscar a chave correta, evitando descompasso de notificação.

**Impacto esperado:** novas transações/status passam a refletir instantaneamente sem F5.

---

### 2) Corrigir o hook de status de recuperação para não travar em cache local
- Refatorar `useTransactionRecoveryLogs` para:
  - consultar por `validIds` (visíveis) mesmo que existam no cache local;
  - usar cache local apenas como valor inicial/otimização;
  - remover lógica “somente IDs fora do cache local”.
- Manter gravação em localStorage após resposta do backend.
- Realtime continuará invalidando as queries de status, mas agora haverá refetch efetivo dos IDs visíveis.

**Impacto esperado:** badge/status de recuperação muda automaticamente ao registrar envio/erro/pendente, sem refresh manual.

---

### 3) Atualizar badge “contactado” imediatamente após ação manual
- Em `BoletoQuickRecovery.registerClick()`:
  - invalidar `["boleto-recovery-count", transaction.id]` após insert;
  - opcionalmente fazer update otimista do contador via `setQueryData`.
- Também invalidar `["boleto-recovery-contacts"]` para consistência com telas de recuperação.

**Impacto esperado:** contador/indicador de contato atualiza no ato.

---

### 4) Garantir realtime também no layout mobile
- Incluir `useTransactionRealtime()` no `MobileLayout`.
- Garantir que exista apenas uma assinatura por sessão (desktop **ou** mobile), sem duplicidade simultânea.

**Impacto esperado:** comportamento realtime consistente em qualquer dispositivo.

---

### 5) Blindagem adicional para timestamps relativos
- Manter o timer de 60s em `TransactionsTable`.
- Aplicar o mesmo padrão onde também existe tempo relativo (ex.: `AbandonedEventsTab`), para evitar “Agora” congelado em outras abas.
- Opcional: extrair hook reutilizável `useRelativeTimeTick(60000)` para padronizar.

**Impacto esperado:** textos relativos evoluem continuamente (“Agora” → “1min atrás” → ...).

---

## Ajustes de backend (se necessário para sincronização entre sessões)

Se quisermos que mudanças de contato em outras sessões/dispositivos também reflitam instantaneamente, incluir realtime para a tabela de contatos de recuperação:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.boleto_recovery_contacts;
```

Observação: isso complementa a invalidação local; não substitui a correção de cache no front.

---

## Arquivos que serão alterados

- `src/hooks/useTransactions.ts`
- `src/hooks/useTransactionRealtime.ts`
- `src/hooks/useTransactionRecoveryLogs.ts`
- `src/components/dashboard/BoletoQuickRecovery.tsx`
- `src/components/mobile/MobileLayout.tsx`
- `src/components/dashboard/AbandonedEventsTab.tsx` (se aplicarmos timer relativo também aqui)
- `supabase/migrations/...sql` (apenas se habilitarmos realtime de `boleto_recovery_contacts`)

---

## Sequência de execução recomendada

1. Corrigir chave de cache de transações + `setQueriesData` no realtime.  
2. Refatorar `useTransactionRecoveryLogs` (remover bloqueio por cache local).  
3. Corrigir invalidação do contador em `BoletoQuickRecovery`.  
4. Adicionar realtime no `MobileLayout`.  
5. (Opcional) incluir realtime de `boleto_recovery_contacts` no backend.  
6. Padronizar timer relativo em componentes faltantes.

---

## Critérios de aceite (teste ponta a ponta)

1. Nova transação entrando no backend aparece na lista em até poucos segundos, sem F5.  
2. Um item marcado como recuperado atualiza badge/status automaticamente.  
3. Clicar em “Abrir conversa no WhatsApp” atualiza contador “contactado” imediatamente.  
4. Texto de tempo relativo muda sozinho após 1–2 minutos (sem interação).  
5. Fluxo funciona igual em desktop e mobile.

---

## Riscos e mitigação

- **Risco:** refetch pesado em tabela grande.  
  **Mitigação:** manter update otimista com `setQueriesData`; evitar refetch completo por evento.

- **Risco:** inconsistência entre cache local e memória.  
  **Mitigação:** transformar cache local em suporte inicial, não em fonte exclusiva.

- **Risco:** múltiplas assinaturas realtime.  
  **Mitigação:** manter assinatura somente no layout ativo por dispositivo (desktop/mobile).

