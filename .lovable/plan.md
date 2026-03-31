

## Unificar contagem de "Contactados" entre manual e automático

### Problema atual
- A recuperação **manual** registra contatos em `boleto_recovery_contacts` mas NÃO em `message_log`
- A recuperação **automática** verifica apenas `message_log` para deduplicação
- Resultado: se 30 boletos foram contactados manualmente, a auto-recovery ignora isso e tenta enviar para todos de novo

### O que será feito

#### 1. Edge function `auto-recovery/index.ts` — considerar contatos manuais
Na seção de boleto recovery, além de pré-carregar `message_log`, também pré-carregar `boleto_recovery_contacts` de hoje e unificar no `phonesContactedTodayCount`:

```
// Além de message_log, também verificar boleto_recovery_contacts de hoje
SELECT transaction_id FROM boleto_recovery_contacts WHERE contacted_at >= hoje
```

Para cada transaction contactada manualmente hoje, buscar o telefone da transação e incrementar o contador de telefones. Também no check por `transaction_id` individual (linha ~393), verificar `boleto_recovery_contacts` além de `message_log`.

#### 2. Frontend — já funciona corretamente
O `useBoletoRecovery.ts` já conta "contactedToday" verificando `boleto_recovery_contacts` com `isTodayInBrazil`, que inclui tanto manual (`whatsapp`) quanto automático (`whatsapp_auto`). E o `shouldContactToday` já verifica se existe contato hoje por regra — ambos os métodos. Nenhuma mudança necessária no frontend.

### Arquivos modificados
- `supabase/functions/auto-recovery/index.ts` — pré-carregar `boleto_recovery_contacts` de hoje e unificar com `message_log` na deduplicação

### Resultado
Se 30 boletos foram contactados manualmente, a auto-recovery reconhece esses contatos e processa apenas os restantes. O contador "Contactados" no frontend já reflete ambos os métodos.

