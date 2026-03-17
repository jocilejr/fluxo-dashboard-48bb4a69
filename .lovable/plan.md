

## Problema

Dois problemas identificados na raiz:

### 1. Eventos multiplicados (5 eventos para 1 produto)
Você tem **4 pixels Meta ativos** na tabela `global_delivery_pixels`. O código chama `loadMetaPixel` em loop para cada pixel. O problema é que `fbq('track', ...)` dispara para **TODOS os pixels inicializados**, não só para o pixel do loop atual. Resultado:

- Call 1: init pixel1 → track Purchase (→ pixel1) = 1 evento
- Call 2: init pixel2 → track Purchase (→ pixel1+2) = 2 eventos  
- Call 3: init pixel3 → track Purchase (→ pixel1+2+3) = 3 eventos
- Call 4: init pixel4 → track Purchase (→ todos) = 4 eventos

Isso cria um **efeito pirâmide** de eventos duplicados. O Meta Pixel Helper mostra 4 Purchase + 1 PageView = 5 eventos visíveis.

### 2. Usuário não reconhecido (Advanced Matching falha)
O `fbq('init', pixelId, advancedMatchingData)` é chamado 4 vezes seguidas. Inits posteriores podem sobrescrever ou conflitar com os dados de Advanced Matching do primeiro init, fazendo o Meta perder a associação com o usuário.

## Solução

Refatorar `firePixels` e `loadMetaPixel` em `src/lib/pixelFiring.ts`:

1. **Agrupar pixels Meta** — Em vez de chamar `loadMetaPixel` individualmente para cada pixel, inicializar todos os pixel IDs Meta de uma vez e usar `fbq('trackSingle', pixelId, event, data)` para disparar eventos **por pixel específico**, evitando o efeito pirâmide.

2. **Inicializar fbq uma só vez com Advanced Matching** — Carregar o SDK, fazer `init` de cada pixel ID com os dados do telefone, disparar `PageView` uma vez, e então usar `trackSingle` para o evento de conversão por pixel.

3. **Manter outros pixels inalterados** — TikTok, Google, Pinterest, Taboola continuam funcionando como estão.

### Código proposto para `loadMetaPixel` → `fireMetaPixels`:

```typescript
// Nova função que recebe TODOS os pixels Meta de uma vez
export const fireMetaPixels = (pixelIds: string[], eventName: string, value: number, phone: string | null) => {
  if (pixelIds.length === 0) return;
  
  const formattedPhone = formatPhoneForMeta(phone);
  
  // Carregar SDK uma vez
  (function(f,b,e,v,n?,t?,s?) { /* IIFE igual */ })(window, document, 'script', '...');
  
  const advancedMatchingData = {};
  if (formattedPhone) {
    advancedMatchingData.ph = formattedPhone;
    advancedMatchingData.external_id = formattedPhone;
  }
  
  // Init cada pixel com Advanced Matching
  for (const pixelId of pixelIds) {
    window.fbq('init', pixelId, advancedMatchingData);
  }
  
  // PageView uma vez (dispara para todos)
  window.fbq('track', 'PageView');
  
  // Purchase com trackSingle para cada pixel (1 evento por pixel, sem pirâmide)
  for (const pixelId of pixelIds) {
    window.fbq('trackSingle', pixelId, eventName || 'Purchase', {
      value, currency: 'BRL', content_type: 'product',
    });
  }
};
```

### Refatorar `firePixels`:
Separar pixels Meta dos demais, chamar `fireMetaPixels` uma vez com todos os IDs, e manter o loop individual para as outras plataformas.

### Refatorar o loop em `AreaMembrosPublica.tsx`:
Chamar `firePixels` uma vez com o valor total ou chamar por frame mas garantindo que a inicialização Meta não se repita.

**Arquivos a modificar:**
- `src/lib/pixelFiring.ts` — Criar `fireMetaPixels`, refatorar `firePixels` para agrupar Meta pixels
- `src/pages/AreaMembrosPublica.tsx` — Nenhuma mudança necessária (a correção é na lib)

