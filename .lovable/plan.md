

## Reverter auto-recovery para usar mensagem da regra (não template)

### Problema
A implementação anterior fez o `auto-recovery` priorizar o template de `boleto_recovery_templates` (do modal de transação) ao invés da mensagem da própria regra (`boleto_recovery_rules.message` + `media_blocks`). São dois sistemas diferentes:

- **Régua (auto-recovery)**: cada regra tem sua própria mensagem e media_blocks — é o que deve ser usado no envio automático
- **Modal da transação (BoletoQuickRecovery)**: usa `boleto_recovery_templates` para montagem manual — é outro contexto

### Mudanças

**1) `supabase/functions/auto-recovery/index.ts`**
- Remover a query de `boleto_recovery_templates` (linhas 391-411)
- Remover o bloco `if (hasTemplate)` que monta mensagem a partir dos template blocks (linhas 539-555)
- Voltar a usar **sempre** `matchedRule.message` + `matchedRule.media_blocks` para montar a mensagem e os media attachments
- Manter todo o resto: dedup, pause/stop, self-continuation, batch control

**2) `src/hooks/useBoletoRecovery.ts`**
- Remover a query de `boleto_recovery_templates` (defaultTemplate)
- Voltar a montar `formattedMessage` usando `applicableRule.message` diretamente
- Remover referências ao `defaultTemplate` nos memos e deps

### O que NÃO muda
- `BoletoQuickRecovery` continua usando `boleto_recovery_templates` para o modal manual
- `BoletoRecoveryModal` continua sendo o editor de templates para uso manual
- Toda a lógica de timing, dedup, pause/stop, self-continuation permanece igual

