

## Separar duplicados no backend e frontend da recuperação de boletos

### Problema
O backend da auto-recovery já pula boletos cujo telefone (últimos 8 dígitos) já recebeu recuperação de boleto hoje. Porém:
1. Esses itens pulados são contados como `skipped` genérico — sem distinção de motivo
2. O frontend não sabe quais foram pulados por duplicidade — continua mostrando como "pendente"
3. Resultado: a UI mostra 27 pendentes quando na verdade muitos são duplicados que nunca seriam enviados

### Solução

#### 1) Backend: registrar duplicados no `message_log`
**Arquivo:** `supabase/functions/auto-recovery/index.ts`

Quando o boleto é pulado por limite diário de telefone (últimos 8 dígitos):
- Escrever uma entrada no `message_log` com `status: 'duplicate'` (em vez de simplesmente pular)
- Incluir `transaction_id`, `rule_id`, `phone`, `message_type: 'boleto'`
- Adicionar `stats.boleto.duplicates` ao contador
- Não chamar `sendMessage` — apenas registrar

Isso permite que o frontend identifique exatamente quais boletos foram marcados como duplicados hoje.

#### 2) Frontend: buscar e classificar duplicados
**Arquivo:** `src/hooks/useBoletoRecovery.ts`

- Na query `boleto-today-logs`, buscar também `status = 'duplicate'` (além de `'sent'`)
- Separar os logs em dois sets: `sentKeys` e `duplicateKeys`
- No processamento dos boletos, classificar cada um como:
  - `contactedToday` — tem log `sent` para `transaction:rule`
  - `duplicateToday` — tem log `duplicate` para `transaction:rule`
  - pendente — nenhum dos dois
- Criar listas derivadas: `duplicateTodayBoletos`, `pendingTodayBoletos` (excluindo duplicados)
- Stats: adicionar `duplicatesToday`

#### 3) UI: mostrar contador de duplicados
**Arquivos:**
- `src/components/dashboard/BoletoRecoveryHeroCard.tsx`
  - Adicionar chip "Duplicados" com ícone e contagem ao lado de "Contactados"
  - Progresso = (contactados + duplicados) / total
  - Texto: "X aguardando contato" usa só os pendentes reais

- `src/components/dashboard/BoletoRecoveryDashboard.tsx`
  - Na aba "Hoje", boletos duplicados mostram badge "Duplicado" (amarelo) em vez de "Pendente"
  - Botão "Iniciar Recuperação" e a fila usam apenas `pendingTodayBoletos` (sem duplicados)

- `src/components/dashboard/BoletoAutoRecoveryToggle.tsx`
  - Quando a recuperação terminar, mostrar `enviadas`, `duplicadas`, `falhas` separadamente

### Detalhes técnicos

**Nova entrada no message_log (backend):**
```typescript
// Quando phone daily limit é atingido:
await supabase.from('message_log').insert({
  phone: normalizedPhone,
  message: 'Duplicado - telefone já contactado hoje',
  message_type: 'boleto',
  status: 'duplicate',
  transaction_id: boleto.id,
  rule_id: matchedRule.id,
  sent_at: new Date().toISOString(),
});
stats.boleto.duplicates++;
```

**Query frontend ajustada:**
```typescript
.from("message_log")
.select("transaction_id, rule_id, status")
.eq("message_type", "boleto")
.in("status", ["sent", "duplicate"])
.not("rule_id", "is", null)
```

**Tipo BoletoWithRecovery atualizado:**
```typescript
export interface BoletoWithRecovery extends Transaction {
  // ... existentes ...
  contactedToday: boolean;
  duplicateToday: boolean;  // novo
}
```

### Trigger de validação
O banco tem um trigger `validate_boleto_message_log_rule_id` que exige `rule_id` para entries de boleto. Como sempre passamos `rule_id` nas entries de duplicate, isso não será afetado.

### O que NÃO muda
- A lógica de timing da régua (quando enviar)
- O conteúdo da mensagem (usa a mensagem da regra)
- O `BoletoQuickRecovery` / modal de transação (fluxo manual separado)
- Deduplicação por `transaction:rule` continua igual
- Self-continuation do backend permanece igual

### Arquivos envolvidos
- `supabase/functions/auto-recovery/index.ts`
- `src/hooks/useBoletoRecovery.ts`
- `src/components/dashboard/BoletoRecoveryHeroCard.tsx`
- `src/components/dashboard/BoletoRecoveryDashboard.tsx`
- `src/components/dashboard/BoletoAutoRecoveryToggle.tsx`

