

## Corrigir contagem de "Contactados" e divergencia de regras entre backend e frontend

### Problemas identificados

**Problema 1: Calculo de datas divergente entre backend e frontend**
O backend (`auto-recovery/index.ts`) calcula `daysSinceCreation` usando o `createdAt` em UTC puro contra `today` em horario de Brasilia, sem converter o `createdAt` para o fuso de Brasilia. O frontend (`useBoletoRecovery.ts`) converte corretamente usando `toZonedTime`. Isso faz com que boletos possam casar com regras diferentes no backend vs frontend. O backend envia 9 mensagens usando a regra correta dele, mas o frontend so mostra 2 como "contactados" porque sua logica de `boletosMatchingRulesToday` retorna um conjunto diferente.

**Problema 2: "Contactados" so conta `boleto_recovery_contacts`, ignora `message_log`**
O stat `contactedToday` (linha 355-357 do hook) verifica apenas se existe um registro em `boleto_recovery_contacts` para hoje. Se por algum motivo o insert falhar ou a regra nao casar no frontend, a contagem fica errada. Deveria tambem considerar `message_log` com `status=sent` e `message_type=boleto` de hoje.

**Problema 3: Timeout do envio (travou)**
Com `batch_pause_seconds = 60` apos cada 10 mensagens, mais `delay_between_messages` entre cada uma, a edge function pode ultrapassar o timeout. 9 mensagens com delays + pausa = facilmente 2+ minutos.

### O que sera feito

#### 1. `supabase/functions/auto-recovery/index.ts` -- Alinhar calculo de datas
Corrigir o bloco de calculo de `daysSinceCreation` e `daysUntilDue` (linhas 373-381) para converter `createdAt` ao fuso de Brasilia antes de calcular, usando o mesmo padrao do frontend:
- Converter `createdAt` para horario de Brasilia
- Zerar horas para pegar inicio do dia
- Calcular `dueDate` a partir desse inicio
- Usar `Math.round` ao inves de `Math.floor` para evitar erros de arredondamento

#### 2. `src/hooks/useBoletoRecovery.ts` -- Incluir `message_log` na contagem de contactados
- Adicionar uma query para buscar registros de `message_log` de hoje com `message_type=boleto` e `status=sent`
- Na contagem de `contactedToday`, considerar um boleto como contactado se:
  - Existe em `boleto_recovery_contacts` hoje, OU
  - Existe em `message_log` hoje com `status=sent` e `transaction_id` correspondente
- Tambem considerar `message_log` no `shouldContactToday` para nao marcar como pendente algo ja enviado

#### 3. `supabase/functions/auto-recovery/index.ts` -- Evitar travamento
- Usar `batch_pause_seconds` como valor real (sem multiplicar por fatores extras)
- Adicionar log antes e depois da pausa para diagnostico
- Verificar se `sendMessage` retornou `false` (falha) e nao contar como enviado

### Arquivos modificados
- `supabase/functions/auto-recovery/index.ts` -- calculo de datas alinhado com frontend
- `src/hooks/useBoletoRecovery.ts` -- incluir message_log na contagem de contactados e no shouldContactToday

