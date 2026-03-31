

## Usar mensagens da Auto Rec em todos os webhooks

### Problema
- **`webhook-receiver`** (PIX/Cartão): lê mensagem de `pix_card_recovery_settings` — tabela antiga
- **`webhook-abandoned`** (Abandonos): lê mensagem de `abandoned_recovery_settings` — tabela antiga, e usa `evolution_api_settings` para configurações em vez de `messaging_api_settings`
- **`auto-recovery`** (Boleto): já usa `messaging_api_settings` — correto

As mensagens configuradas na **Auto Rec.** (`messaging_api_settings`) não são usadas pelos webhooks.

### Alterações

#### 1. `supabase/functions/webhook-receiver/index.ts`
- **Remover** busca em `pix_card_recovery_settings` (linhas 381-391)
- **Usar** `messagingSettings.auto_pix_card_message` (já carregado na linha 317-321)
- Se campo vazio → skip com log

#### 2. `supabase/functions/webhook-abandoned/index.ts`
- **Trocar** busca de configurações de `evolution_api_settings` → `messaging_api_settings`
- Usar campos: `is_active`, `abandoned_recovery_enabled`, `working_hours_enabled/start/end`, `daily_limit`
- **Trocar** busca de mensagem de `abandoned_recovery_settings` → usar `messagingSettings.auto_abandoned_message`
- **Trocar** envio via `evolution-send-message` → `send-external-message` (mesmo padrão do webhook-receiver)
- Usar `message_log` em vez de `evolution_message_log` para checagem de duplicatas e limites diários

#### 3. Nenhuma tabela antiga removida
- `pix_card_recovery_settings` e `abandoned_recovery_settings` continuam existindo para a recuperação **manual** na tela de Transações

### Resultado
Todas as mensagens automáticas (PIX/Cartão, Abandono, Boleto) passam a usar exclusivamente as configurações e mensagens da **Auto Rec.** (`messaging_api_settings`).

