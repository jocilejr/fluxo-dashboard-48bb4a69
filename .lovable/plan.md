
## Corrigir inconsistência da recuperação de boletos

### Do I know what the issue is?
Sim.

### Problemas reais encontrados
1. A UI está **dobrando os duplicados**:
   - `stats.contactedToday` no hook já inclui `enviados + duplicados`
   - `BoletoRecoveryHeroCard` soma `contactedToday + duplicatesToday` de novo
   - por isso aparece **40/38** e **105%**

2. O dashboard e o auto-envio não estão usando exatamente o mesmo critério:
   - o frontend mostra boleto “de hoje” só por regra aplicável
   - o backend ainda filtra/decide envio com critérios próprios
   - resultado: alguns itens seguem como **Pendentes** na tela, mas não entram no envio real

3. O backend pode criar **duplicate** repetido para o mesmo boleto:
   - hoje ele aplica o bloqueio por telefone antes de validar se aquele `transaction_id:rule_id` já foi processado
   - em novas execuções isso pode inflar logs e contadores

4. A janela de “hoje” no backend está frágil:
   - há cálculo manual de data/hora do Brasil com `setHours`
   - isso pode puxar logs fora do dia correto e distorcer a deduplicação

### O que vou ajustar

#### 1) Consertar a matemática da UI
**Arquivos**
- `src/hooks/useBoletoRecovery.ts`
- `src/components/dashboard/BoletoRecoveryHeroCard.tsx`

**Ajustes**
- manter `contactedToday` como total resolvido do dia: **enviados + duplicados**
- o card passa a mostrar:
  - **Contactados:** `contactedToday / totalToday`
  - **Duplicados:** contador separado, apenas informativo
  - **Progresso:** `contactedToday / totalToday`
- limitar o progresso visual a no máximo 100%

#### 2) Unificar a elegibilidade entre frontend e backend
**Arquivos**
- `src/hooks/useBoletoRecovery.ts`
- `supabase/functions/auto-recovery/index.ts`

**Ajustes**
- alinhar os critérios de “pode ser enviado agora”
- classificar cada boleto do dia em estados reais:
  - `sent`
  - `duplicate`
  - `pendingActionable`
  - `missingPhone` / `blocked`
- fazer “Pendente” significar apenas o que ainda pode ser processado

#### 3) Corrigir a ordem da deduplicação no backend
**Arquivo**
- `supabase/functions/auto-recovery/index.ts`

**Ajustes**
- verificar primeiro se o par `transaction_id:rule_id` já existe hoje
- só depois aplicar o limite por últimos 8 dígitos
- se o boleto já tiver sido marcado hoje, não criar outro `duplicate`

#### 4) Padronizar o cálculo de “hoje” no backend
**Arquivo**
- `supabase/functions/auto-recovery/index.ts`

**Ajustes**
- trocar a lógica manual por uma janela explícita do dia em `America/Sao_Paulo`
- aplicar isso em:
  - leitura dos logs do dia
  - contagem diária
  - comparações da régua

#### 5) Ajustar a tela para refletir os estados corretos
**Arquivos**
- `src/components/dashboard/BoletoRecoveryDashboard.tsx`
- `src/components/dashboard/BoletoRecoveryQueue.tsx`

**Ajustes**
- badges coerentes para cada caso
- “Pendentes” não mistura itens já resolvidos/duplicados
- se houver boleto sem telefone, isso aparece claramente em vez de parecer falha de envio
- a fila usa só os realmente acionáveis

### Resultado esperado
- some o bug de **40/38** e **105%**
- “Contactados” continua incluindo duplicados, mas sem dupla contagem
- o número de “Pendentes” passa a bater com o que ainda é realmente enviável
- reexecuções da automação não vão mais inflar duplicados
- dashboard e auto-recovery passam a falar a mesma língua

### Detalhes técnicos
- sem mudança de banco
- arquivos principais:
  - `src/hooks/useBoletoRecovery.ts`
  - `src/components/dashboard/BoletoRecoveryHeroCard.tsx`
  - `src/components/dashboard/BoletoRecoveryDashboard.tsx`
  - `src/components/dashboard/BoletoRecoveryQueue.tsx`
  - `supabase/functions/auto-recovery/index.ts`
