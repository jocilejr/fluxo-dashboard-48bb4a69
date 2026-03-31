
## Diagnóstico direto (por que parece “não implementado”)

Você tem razão em cobrar: o comportamento ficou incompleto.

Nas atualizações anteriores foram feitas duas coisas diferentes:
1. **UI de template**: o seletor foi removido da barra errada e mantido no modal correto (`Transações > Boleto Ger. > Config`).
2. **Envio imediato de boleto**: foi implementado no fluxo do `external-messaging-webhook`, **mas não no `webhook-receiver` principal** (que é justamente o endpoint exibido em Transações).

Resultado: se o boleto entra por `webhook-receiver`, o imediato não dispara.

---

## Plano de correção (implementação)

1. **Adicionar gatilho de boleto imediato no `webhook-receiver`**
   - Arquivo: `supabase/functions/webhook-receiver/index.ts`
   - Após criar transação nova de boleto (status gerado/pendente), disparar `auto-recovery` com:
   - `{ type: 'boleto', transactionId: data.id }`
   - Em background (sem bloquear resposta do webhook).

2. **Aplicar a mesma lógica no roteador `main`**
   - Arquivo: `supabase/functions/main/index.ts` (função `handleWebhookReceiver`)
   - Replicar o mesmo trigger para evitar diferença entre endpoints (`/webhook-receiver` e `/main/webhook-receiver`).

3. **Respeitar o toggle de Boletos Gerados no envio imediato**
   - Arquivo: `supabase/functions/auto-recovery/index.ts`
   - No bloco `specificType === 'boleto'`, validar `settings.boleto_recovery_enabled`.
   - Se estiver desligado, retornar `skipped` sem enviar.

4. **Manter separação dos dois fluxos (sem regressão)**
   - **Imediato de Transações**: envia ao criar boleto.
   - **Follow-up da Recuperação**: continua preso à hora configurada (`boleto_send_hour`) no batch diário.
   - Não misturar os dois gatilhos.

5. **Validação final**
   - Testar criação de boleto novo pelos dois webhooks.
   - Confirmar registro em `message_log` com `message_type = 'boleto_immediate'`.
   - Confirmar uso do template padrão de `boleto_recovery_templates`.
   - Confirmar que falha de envio retorna erro de envio (sem validar existência de contato no cliente).

---

## Detalhes técnicos

- Arquivos-alvo:
  - `supabase/functions/webhook-receiver/index.ts`
  - `supabase/functions/main/index.ts`
  - `supabase/functions/auto-recovery/index.ts`
- Não requer mudança de schema/migração.
- Não altera posição do template no front (continua no modal correto de Transações).
