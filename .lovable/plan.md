

## Plano: Adaptar endpoints para a API real do Chatbot Simplificado

### Contexto

Atualmente as edge functions usam endpoints genéricos (`/api/send-message`, `/api/validate-number`, `/api/sync-customers`, etc.). Precisamos atualizar para os endpoints reais da sua API em `https://app.chatbotsimplificado.com/api/platform/...`.

Além disso, sua API oferece funcionalidades adicionais (tags, reminders) que ainda não estão integradas.

### O que será alterado

**1. `send-external-message/index.ts`**
- Trocar endpoint de `/api/send-message` para `POST /api/platform/contacts` (criar/atualizar contato) + lógica de envio de mensagem conforme necessário
- Usar os campos corretos: `{ phone, name, instance_name }`

**2. `validate-external-number/index.ts`**
- Trocar `/api/validate-number` para `GET /api/platform/contacts/:phone`
- Se retornar dados, o número existe; se 404, não existe

**3. `sync-external-data/index.ts`**
- `sync_customers`: trocar `/api/sync-customers` para loop de `POST /api/platform/contacts` por cliente
- `sync_transactions`: trocar `/api/sync-transactions` para loop de `POST /api/platform/transactions` por transação
- `sync_customer`: trocar `/api/sync-customer` para `POST /api/platform/contacts` + `POST /api/platform/transactions` por transação do cliente
- `sync_transaction`: trocar `/api/sync-transaction` para `POST /api/platform/transactions`

**4. `external-messaging-webhook/index.ts`**
- Manter como está (recebe dados da API externa para o dashboard)
- Adicionar suporte ao evento `transaction_webhook` que pode vir de `POST /api/platform/transactions/webhook`

**5. `ExternalApiSettings.tsx`**
- Trocar URL do teste de conexão de `/api/validate-number` para `GET /api/platform/contacts?limit=1`
- Hardcodar a base URL como `https://app.chatbotsimplificado.com` ou manter configurável

**6. Novas funcionalidades (tags e lembretes)**
- Adicionar ações de sync para tags: ao marcar/categorizar um cliente no dashboard, enviar `POST /api/platform/tags`
- Adicionar ações de sync para lembretes: criar `POST /api/platform/reminders` quando houver follow-ups programados

### Mapeamento dos endpoints

```text
Dashboard Action              →  API Endpoint
─────────────────────────────────────────────────────
Validar número                →  GET  /api/platform/contacts/:phone
Criar/sync contato            →  POST /api/platform/contacts
Listar contatos               →  GET  /api/platform/contacts?phone=&name=&limit=&offset=
Criar transação               →  POST /api/platform/transactions
Atualizar transação           →  PATCH /api/platform/transactions/:id
Webhook de transação          →  POST /api/platform/transactions/webhook
Listar transações             →  GET  /api/platform/transactions?status=&from=&to=&phone=
Adicionar tag                 →  POST /api/platform/tags
Remover tag                   →  DELETE /api/platform/tags
Listar tags                   →  GET  /api/platform/tags?phone=
Criar lembrete                →  POST /api/platform/reminders
Atualizar lembrete            →  PATCH /api/platform/reminders/:id
Listar lembretes              →  GET  /api/platform/reminders?filter=&phone=
```

### Detalhes técnicos

- A URL base `https://app.chatbotsimplificado.com` será lida da tabela `messaging_api_settings.server_url` (já configurável)
- Autenticação via `Bearer ${api_key}` (já implementado)
- Não é necessário criar novas tabelas
- As edge functions existentes serão atualizadas para usar os endpoints corretos

