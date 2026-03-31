

## Remover validação prévia de telefone — enviar direto e inferir existência pelo resultado

### Problema
A validação prévia via `validate-external-number` usa um endpoint incorreto e bloqueia envios para números válidos. O usuário quer uma abordagem mais simples: enviar a mensagem diretamente e, se falhar, marcar como inexistente.

### O que será feito

#### 1. `supabase/functions/auto-recovery/index.ts`
Remover o bloco de validação prévia (linhas ~170-201) da função `sendMessage`. Manter apenas o envio via `send-external-message`. Após o envio, se o resultado indicar falha com erro de número inválido, salvar na tabela `phone_validations` com `exists_on_whatsapp = false`. Se sucesso, salvar com `exists_on_whatsapp = true`.

#### 2. `supabase/functions/webhook-receiver/index.ts`
Remover o bloco de validação prévia (linhas ~399-433) da recuperação instantânea PIX/Card. Após o envio, se falhar, registrar `phone_validations` como inexistente. Se sucesso, registrar como existente.

#### 3. `supabase/functions/webhook-abandoned/index.ts`
Remover o bloco de validação prévia (linhas ~169-202) da recuperação de abandonos. Mesma lógica: inferir existência pelo resultado do envio.

#### 4. `supabase/functions/send-external-message/index.ts`
Adicionar lógica após o resultado do envio: se a API externa retornar sucesso, fazer upsert em `phone_validations` com `exists_on_whatsapp = true`. Se retornar erro (especialmente 404 ou erro de número), upsert com `exists_on_whatsapp = false`. Isso centraliza a inferência em um único lugar.

#### 5. Limpeza de cache antigo
- Migration SQL: `DELETE FROM phone_validations WHERE exists_on_whatsapp = false` para limpar resultados incorretos anteriores
- `src/lib/localCache.ts`: adicionar flag de versão `phone_validation_cache_v2` para forçar limpeza do localStorage na próxima sessão

### Detalhes técnicos

**Em `send-external-message/index.ts`**, após o resultado do envio:
```typescript
// Após sendResponse.ok ou !sendResponse.ok
await supabase.from('phone_validations').upsert({
  normalized_phone: normalizedPhone,
  exists_on_whatsapp: sendResponse.ok,
  validated_at: new Date().toISOString(),
}, { onConflict: 'normalized_phone' });
```

**Nas 3 edge functions de recovery**: simplesmente remover os blocos `validate-external-number` e deixar o `send-external-message` cuidar da validação implícita.

### Arquivos modificados
- `supabase/functions/auto-recovery/index.ts` — remover validação prévia
- `supabase/functions/webhook-receiver/index.ts` — remover validação prévia
- `supabase/functions/webhook-abandoned/index.ts` — remover validação prévia
- `supabase/functions/send-external-message/index.ts` — adicionar upsert em phone_validations
- Migration SQL — limpar validações falsas
- `src/lib/localCache.ts` — invalidar cache local antigo

### Resultado
Mensagens são enviadas diretamente sem etapa de validação. Se o envio funcionar, o número é marcado como existente. Se falhar, é marcado como inexistente. Elimina falsos negativos e simplifica o fluxo.

