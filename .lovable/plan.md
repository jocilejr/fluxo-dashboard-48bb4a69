

## Plano: Remover Evolution API e criar integração com aplicação externa de mensagens

### Contexto

Atualmente, a Evolution API é usada para: enviar mensagens WhatsApp (recuperação boleto, PIX/cartão, abandonos), validar números no WhatsApp, e auto-recovery automática. Tudo isso será substituído por uma integração bidirecional com sua aplicação externa.

### Contrato de API proposto

Vamos definir dois fluxos de comunicação:

**A) Dashboard envia para sua aplicação externa:**

1. **Enviar mensagem** — `POST {sua_url}/api/send-message`
```json
{
  "phone": "5511999999999",
  "message": "Texto formatado",
  "type": "boleto" | "pix_card" | "abandoned",
  "reference_id": "uuid da transação ou evento",
  "customer_name": "Nome do cliente",
  "amount": 50.00
}
```
Resposta esperada:
```json
{ "success": true, "message_id": "id-externo" }
```

2. **Validar número** — `POST {sua_url}/api/validate-number`
```json
{ "phone": "5511999999999" }
```
Resposta esperada:
```json
{ "exists": true, "is_mobile": true }
```

3. **Sincronizar dados de cliente** — `POST {sua_url}/api/sync-customer`
```json
{
  "phone": "5511999999999",
  "name": "Nome",
  "email": "email@example.com",
  "total_paid": 150.00,
  "total_transactions": 3,
  "last_transaction_at": "2026-03-30T..."
}
```

**B) Sua aplicação externa envia para o dashboard (via webhook):**

1. **Atualizar status de mensagem** — `POST /functions/v1/external-messaging-webhook`
```json
{
  "event": "message_status",
  "message_id": "id-externo",
  "reference_id": "uuid",
  "status": "sent" | "delivered" | "read" | "failed",
  "error": "motivo do erro (opcional)"
}
```

2. **Notificar resposta do cliente** — mesmo endpoint
```json
{
  "event": "customer_reply",
  "phone": "5511999999999",
  "message": "Texto da resposta",
  "timestamp": "2026-03-30T..."
}
```

---

### O que será feito

**1. Remover Evolution API (tabelas, funções, componentes)**

- Deletar edge functions: `evolution-send-message`, `evolution-test-connection`, `evolution-validate-number`, `evolution-auto-recovery`
- Remover componentes: `EvolutionApiSettings.tsx`, `EvolutionMessageLogs.tsx`
- Remover badge de status Evolution do `AppLayout.tsx`
- Remover aba "Evolution API" de `Configuracoes.tsx`
- Remover referências em `usePhoneValidation.ts` (tirar dependência de `evolution_api_settings`)
- Remover referências no `webhook-receiver` (auto-recovery instantânea)
- Remover referências no `useTransactionRealtime.ts`
- Remover entradas de `supabase/config.toml` das 4 funções evolution
- Migração SQL: dropar tabela `evolution_api_settings` (a tabela `evolution_message_log` será renomeada/adaptada)

**2. Criar nova tabela de configuração**

- `messaging_api_settings`: URL base da API externa, API key, ativo/inativo, limites, horários
- Renomear `evolution_message_log` para `message_log` (ou criar nova e migrar dados)

**3. Criar nova edge function `send-external-message`**

- Substitui `evolution-send-message`
- Lê config de `messaging_api_settings`
- Faz POST para `{url_externa}/api/send-message`
- Registra log na tabela de mensagens

**4. Criar nova edge function `external-messaging-webhook`**

- Recebe callbacks da sua aplicação externa
- Atualiza status das mensagens no log
- Registra respostas de clientes

**5. Criar nova edge function `validate-external-number`**

- Substitui `evolution-validate-number`
- Faz POST para `{url_externa}/api/validate-number`

**6. Adaptar auto-recovery**

- Criar `auto-recovery` (substitui `evolution-auto-recovery`)
- Usa `messaging_api_settings` em vez de `evolution_api_settings`
- Chama `send-external-message` em vez de `evolution-send-message`

**7. Adaptar componentes de UI**

- Nova tela de configuração da API externa em Configurações (substituindo EvolutionApiSettings)
- Adaptar `AppLayout.tsx` para mostrar status da API externa
- Adaptar `usePhoneValidation.ts` para usar nova função de validação
- Adaptar webhook-receiver para usar nova função de envio

**8. Tela de configuração**

- Campo: URL base da API externa
- Campo: API Key / Token de autenticação
- Toggle: Ativo/Inativo
- Botão: Testar conexão
- Campos de limite diário e horário de funcionamento (manter os existentes)
- Logs de mensagens (reaproveitar formato existente)

### Detalhes técnicos

- A API key da aplicação externa será armazenada na tabela `messaging_api_settings` (como hoje é feito com Evolution)
- Autenticação dos webhooks recebidos: HMAC signature ou Bearer token configurável
- As tabelas `pix_card_recovery_settings`, `abandoned_recovery_settings`, `boleto_recovery_rules` permanecem inalteradas
- Os componentes `BoletoQuickRecovery` e `PixCardQuickRecovery` continuam funcionando, chamando a nova edge function

