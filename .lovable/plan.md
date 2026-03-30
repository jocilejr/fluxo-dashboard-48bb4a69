

## Plano: Adicionar logging detalhado em cada ponto de falha

### Problema
A edge function `fetch-instances` tem falhas silenciosas — quando a resposta não é OK ou não é JSON, ela faz `continue` sem logar nada. Por isso não vemos o que a API retorna.

### Solução
Adicionar `console.log`/`console.error` em cada ponto de falha para diagnosticar exatamente onde e por que a busca falha.

### Alteração

**Arquivo: `supabase/functions/fetch-instances/index.ts`**

Dentro do loop `for`, adicionar logs em cada branch de falha:

```ts
for (const url of urlsToTry) {
  try {
    console.log(`Trying URL: ${url}/api/platform/instances`);
    const response = await fetch(`${url}/api/platform/instances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': api_key,
      },
    });

    console.log(`Response status: ${response.status}, content-type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const body = await response.text();
      console.error(`Non-OK response (${response.status}): ${body.substring(0, 500)}`);
      continue;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const body = await response.text();
      console.error(`Unexpected content type: ${contentType}. Body: ${body.substring(0, 500)}`);
      continue;
    }

    const data = await response.json();
    console.log('API response data:', JSON.stringify(data));
    // ... rest stays the same
  } catch (err) {
    console.error(`Fetch error for ${url}:`, err);
    continue;
  }
}
```

Isso é **apenas logging** — sem mudança de comportamento. Após testar novamente, os logs mostrarão exatamente o status HTTP, content-type e corpo da resposta para cada URL tentada.

