

## Corrigir header de autenticação no envio de mensagens

### Problema
A edge function `send-external-message` usa `Authorization: Bearer` para autenticar na API externa, mas a API do Chatbot Simplificado espera o header `X-API-Key`. Isso causa rejeição da requisição (retorna HTML), que é a causa raiz de todos os erros de envio.

Prova: `fetch-instances` (que funciona corretamente) usa `X-API-Key`.

### Correção

**Arquivo:** `supabase/functions/send-external-message/index.ts`

Linha 104-108 — trocar:
```ts
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${settings.api_key}`,
};
```

Por:
```ts
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-API-Key': settings.api_key,
};
```

Nenhuma outra alteração necessária. A instância já está sendo passada corretamente no payload (`instanceName` vindo do `auto-recovery` → campo `instance` no body).

