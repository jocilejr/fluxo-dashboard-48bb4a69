

## Plano: Diagnosticar e corrigir parsing da resposta de instâncias

### Problema
A edge function `fetch-instances` conecta com sucesso na API (`api.chatbotsimplificado.com/api/platform/instances`), recebe resposta 200 com JSON, mas retorna `instances: []`. Provavelmente a estrutura da resposta da API não é um array direto nem `{ instances: [...] }` — pode ser `{ data: [...] }` ou outro formato.

### Solução
Adicionar `console.log` na edge function para registrar a resposta crua da API. Assim, no próximo teste, os logs mostrarão a estrutura exata e poderemos ajustar o parsing.

### Alterações

**Arquivo: `supabase/functions/fetch-instances/index.ts`**
- Após `const data = await response.json()` (linha 50), adicionar:
  ```ts
  console.log('API response data:', JSON.stringify(data));
  ```
- Expandir o fallback de extração para cobrir mais formatos comuns:
  ```ts
  const instances = Array.isArray(data) 
    ? data 
    : data.instances || data.data || data.results || [];
  ```

Isso é uma alteração mínima (2 linhas) que nos dará visibilidade total sobre o que a API retorna.

