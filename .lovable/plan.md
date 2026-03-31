

## Remover opção "Imediatamente" da régua de cobrança de boletos

### Contexto
O envio imediato ao gerar boleto é tratado na aba de Transações (via webhook-receiver), e não tem relação com a régua de cobrança. Manter a opção `immediate` na régua causa confusão e mistura dois fluxos distintos.

### O que será feito

#### 1. `src/components/dashboard/BoletoRecoveryRulesConfig.tsx`
- Remover `<SelectItem value="immediate">Imediatamente ao gerar</SelectItem>` do select de tipo de regra
- Remover tratamento de `immediate` no label/badge (linhas que checam `rule.rule_type === 'immediate'`)
- Remover a lógica que seta `days: 0` quando tipo é `immediate`
- Manter apenas: `days_after_generation`, `days_before_due`, `days_after_due`

#### 2. `supabase/functions/auto-recovery/index.ts`
- Adicionar `.neq('rule_type', 'immediate')` na query de regras (linha ~304), para que mesmo se existirem regras `immediate` antigas no banco, elas sejam ignoradas pela recuperação automática

#### 3. `src/hooks/useBoletoRecovery.ts`
- Confirmar que a interface `RecoveryRule` já não inclui `immediate` no `rule_type` (já está correto, linha 32)
- No `processedBoletos`, pular regras com `rule_type === 'immediate'` caso venham do banco

#### 4. Limpeza (Migration SQL)
- `UPDATE boleto_recovery_rules SET is_active = false WHERE rule_type = 'immediate';` para desativar regras immediate existentes

### Resultado
A régua de cobrança fica exclusivamente para follow-ups baseados em dias. O envio imediato ao gerar boleto continua sendo gerido separadamente no fluxo de transações.

