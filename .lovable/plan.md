

## Problema: mensagens legadas sem `rule_id` bloqueiam toda a recuperação

### Diagnóstico

A função `auto-recovery` carrega **todos** os `message_log` de boleto enviados hoje para montar a deduplicação por telefone (`phoneDailyCount`). Hoje existem:

- **28 mensagens "sent"** no total
- **8 com `rule_id`** (válidas, do sistema novo)
- **20 sem `rule_id`** (legado, de runs bugados anteriores)

Com `max_messages_per_person_per_day = 1`, os 20 registros legados preenchem o mapa de telefones, **bloqueando todos os 86 boletos que casam com regras** — inclusive os 33 que nunca foram contactados.

### Solução

**Arquivo: `supabase/functions/auto-recovery/index.ts`**

Filtrar a query de `todayLogs` (linhas 406-411) para incluir apenas registros com `rule_id IS NOT NULL`:

```sql
-- antes (pega tudo, inclusive legado sem rule_id):
.eq('message_type', 'boleto').eq('status', 'sent').gte(...)

-- depois (ignora legado):
.eq('message_type', 'boleto').eq('status', 'sent').not('rule_id', 'is', null).gte(...)
```

Isso garante que:
- O `phoneDailyCount` só conta envios válidos (com regra)
- O `sentTodayKeys` só registra pares `transaction:rule` válidos
- Mensagens legadas sem `rule_id` param de interferir

### O que NÃO muda
- A deduplicação `transaction:rule` continua funcionando
- O limite de 1 mensagem por pessoa por dia continua ativo
- O controle de pausa/stop/continuação permanece igual

