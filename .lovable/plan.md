

## Implementar Meta Conversions API (CAPI) Server-Side

### Visão geral
Criar uma edge function que envia eventos de conversão diretamente para a API do Meta via servidor, usando o `access_token` já armazenado na tabela `global_delivery_pixels`. O pixel no navegador continua funcionando em paralelo, e a deduplicação é feita via `event_id`.

### Arquitetura

```text
Usuário acessa página
       │
       ├──► Browser: fbq('trackSingle', ..., {event_id})  ← já existe
       │
       └──► Backend: POST /meta-conversions-api
                │
                └──► Meta CAPI: graph.facebook.com/v21.0/{pixel_id}/events
                     (phone SHA256, email SHA256, event_id para dedup)
```

### Mudanças

**1. Nova edge function `meta-conversions-api/index.ts`**
- Recebe: `pixel_id`, `access_token`, `event_name`, `value`, `phone`, `email`, `first_name`, `last_name`, `event_id`
- Hasheia dados pessoais com SHA256 (requisito Meta)
- Envia POST para `https://graph.facebook.com/v21.0/{pixel_id}/events`
- Payload: `user_data` (ph, em, fn, ln, external_id, country) + `custom_data` (value, currency)
- Retorna sucesso/erro

**2. Atualizar `supabase/config.toml`**
- Adicionar entrada `[functions.meta-conversions-api]` com `verify_jwt = false`

**3. Atualizar `src/lib/pixelFiring.ts`**
- Gerar `event_id` único (crypto.randomUUID) para cada evento
- Passar `event_id` no `fbq('trackSingle', ...)` para deduplicação
- Após disparar pixel browser, chamar a edge function para pixels Meta que tenham `access_token` configurado
- Pixels sem `access_token` continuam apenas com pixel browser

**4. Atualizar `src/pages/AreaMembrosPublica.tsx` e `EntregaPublica.tsx`**
- Passar `access_token` junto com os dados de pixel para `firePixels`

### Resultado esperado
- Cada conversão é enviada **duas vezes** (browser + servidor)
- Meta deduplica automaticamente pelo `event_id`
- Match rate sobe significativamente porque o servidor envia dados completos hasheados
- Pixels sem token continuam funcionando normalmente só pelo browser

