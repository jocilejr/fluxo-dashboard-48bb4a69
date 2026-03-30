

## Plano: Implementar todos os eventos da API externa no webhook

### Eventos a adicionar no `external-messaging-webhook`

O webhook atual já suporta: `message_status`, `customer_reply`, `sync_customer`, `sync_transaction`, `transaction_webhook`, `sync_abandoned_event`, `sync_reminder`, `reminder_updated`, `reminder_deleted`, `bulk_sync`.

Faltam 5 eventos da documentação:

| Evento | Ação |
|---|---|
| `payment_confirmed` | Buscar transação por `reference_id` ou `external_id`, atualizar status para "pago", `paid_at`, e dados do cliente. Se vier `tags_add`/`tags_remove`, logar (sem tabela de tags ainda). Se vier `message`, enviar via `send-external-message`. |
| `payment_failed` | Buscar transação por `reference_id`/`external_id`, atualizar status. |
| `payment_refunded` | Buscar transação por `reference_id`/`external_id`, atualizar status para "estornado". |
| `customer_updated` | Buscar cliente por phone (last 8 digits), atualizar nome e dados. Similar ao `sync_customer` existente. |
| `invoice_created` | Criar transação com tipo "boleto" ou genérico, vinculada ao phone e reference_id. |

### Arquivos a alterar

**1. `supabase/functions/external-messaging-webhook/index.ts`**
- Adicionar 5 blocos `if (event === '...')` para os novos eventos
- `payment_confirmed`: lookup por `external_id` OR `reference_id` (campo `external_id` na tabela transactions), update status/paid_at/amount/customer data
- `payment_failed`: lookup + update status
- `payment_refunded`: lookup + update status para "estornado"
- `customer_updated`: reusa lógica do `sync_customer` com phone obrigatório
- `invoice_created`: insert na tabela transactions com dados do payload

**2. `src/components/settings/ExternalApiSettings.tsx`**
- Atualizar lista de eventos documentados para incluir os 5 novos

### Detalhes técnicos
- Lookup de transação: buscar por `external_id` = `reference_id` OU `external_id` do payload
- Para `payment_confirmed` com campo `message`: não enviar mensagem automaticamente neste momento (evitar complexidade), apenas logar
- `tags_add`/`tags_remove`: logar no console por enquanto (não existe tabela de tags no banco)
- Nenhuma migração necessária - todas as colunas já existem nas tabelas `transactions` e `customers`
- Validação de input com checks básicos (campos obrigatórios)

