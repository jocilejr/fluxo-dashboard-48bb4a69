
## Ajuste de direção (confirmado)
Você está certo: **não deve existir “contactado” sem regra**.  
A partir daqui, a lógica fica estritamente assim:

- só entra na recuperação do dia quem tem **regra ativa aplicável hoje**;
- só conta como contactado quem tem **envio registrado vinculado à regra**;
- sem regra ativa = não envia, não entra na fila, não entra no card.

## Diagnóstico do que precisa ser corrigido
Hoje ainda há dois pontos que permitem distorção:

1. `message_log` de boleto ainda não guarda vínculo obrigatório com a regra (`rule_id` não está sendo preenchido no envio).
2. ação manual de “Contactado” grava em `boleto_recovery_contacts`, mas não alimenta `message_log`, então a fila/contagem pode ficar inconsistente.

## Plano de implementação (revisado)

### 1) Tornar `rule_id` obrigatório no fluxo de envio de boleto
**Arquivos:**
- `supabase/functions/auto-recovery/index.ts`
- `supabase/functions/send-external-message/index.ts`

**Mudanças:**
- `auto-recovery` passa `ruleId` ao chamar `send-external-message` (sempre `matchedRule.id`).
- `send-external-message` aceita `ruleId` no payload e grava em `message_log.rule_id`.
- Se `messageType === 'boleto'` e `ruleId` faltar: rejeitar envio (erro controlado).  
Isso elimina envio de boleto “sem regra”.

### 2) Deduplicação e contagem por chave de regra (não só transação)
**Arquivo:**
- `supabase/functions/auto-recovery/index.ts`

**Mudanças:**
- carregar logs do dia com `transaction_id, rule_id, phone`;
- dedup por `transaction_id + rule_id` (além de limite por pessoa/dia);
- manter envio apenas quando houver regra ativa casada.

### 3) Frontend contar apenas “contactados com regra aplicável hoje”
**Arquivo:**
- `src/hooks/useBoletoRecovery.ts`

**Mudanças:**
- Query de logs do dia retorna `transaction_id, rule_id`;
- montar set por chave `txId:ruleId`;
- `todayBoletos` = **somente** boletos com `applicableRule !== null`;
- `contactedTodayBoletos` = subset de `todayBoletos` com log da mesma regra;
- `stats` calculadas só desse conjunto (sem incluir nenhum “enviado sem regra”).

### 4) Ajustar marcação manual para refletir o mesmo critério
**Arquivos:**
- `src/hooks/useBoletoRecovery.ts`
- `src/components/dashboard/BoletoRecoveryQueue.tsx` (uso)
  
**Mudanças:**
- ao “Marcar Contactado” na fila manual, registrar também evento de envio em `message_log` com:
  - `message_type='boleto'`
  - `status='sent'`
  - `transaction_id`
  - `rule_id` da regra aplicada
- `boleto_recovery_contacts` pode continuar como histórico auxiliar, mas não será fonte de contagem principal.

### 5) Regras de proteção de dados (hardening)
**Banco (nova migration):**
- já existe coluna `rule_id`; complementar com garantia de consistência futura:
  - validação para impedir novos `message_log` de boleto com `rule_id` nulo (via trigger de validação para INSERT/UPDATE).
- não mexer em dados antigos se você quer “deixar o erro passado pra lá”.

## Resultado esperado
- Zero “contactado sem regra” na tela.
- Fila diária mostra apenas quem realmente deve ser contatado pela régua ativa.
- Card “Contactados” e “Pendentes” batem com a operação real.
- Reexecução no mesmo dia não reenfileira indevidamente o mesmo boleto/regra.
