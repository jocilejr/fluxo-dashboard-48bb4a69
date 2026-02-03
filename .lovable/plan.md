

## Reformulação Completa do Disparo do Meta Pixel

### Problema Identificado

O código atual tem falhas na ordem de execução:
1. Definimos `n.loaded = true` manualmente antes do script carregar
2. Chamamos `fireMetaEvent()` duas vezes - uma antes do script carregar e outra no `onload`
3. A verificação `window.fbq.loaded` sempre retorna true porque definimos manualmente

### Solução: Usar o Código Oficial do Meta Pixel

Vamos reescrever a função `loadMetaPixel` usando exatamente o padrão oficial do Meta, garantindo que:
1. O script seja carregado primeiro
2. Os comandos `fbq` sejam enfileirados corretamente
3. Os eventos sejam disparados apenas após o script carregar

### Alterações Técnicas

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/EntregaPublica.tsx` | Reescrever completamente a função `loadMetaPixel` |

### Nova Implementação

```javascript
const loadMetaPixel = (pixelId: string, eventName: string, value: number, phone: string | null) => {
  const formattedPhone = formatPhoneForMeta(phone);
  console.log(`[Pixel] Loading Meta Pixel: ${pixelId}`);
  
  // Usar o código oficial do Meta Pixel via IIFE
  (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return; // Já existe, não recarregar
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  // Preparar dados de Advanced Matching
  const advancedMatchingData: { ph?: string; external_id?: string } = {};
  if (formattedPhone) {
    advancedMatchingData.ph = formattedPhone;
    advancedMatchingData.external_id = formattedPhone;
  }

  // Enfileirar os comandos (serão processados quando o script carregar)
  window.fbq('init', pixelId, advancedMatchingData);
  window.fbq('track', 'PageView');
  window.fbq('track', eventName || 'Purchase', {
    value: value,
    currency: 'BRL',
    content_type: 'product',
  });
  
  console.log(`[Pixel] Meta ${eventName} queued for ${pixelId}`);
};
```

### Diferenças Principais

| Antes | Depois |
|-------|--------|
| Verificava `fbq.loaded` manualmente | Usa verificação nativa `if (f.fbq) return` |
| Chamava `fireMetaEvent()` duas vezes | Enfileira comandos uma única vez |
| Script carregado separadamente | Script carregado dentro da IIFE oficial |
| Lógica complexa de callbacks | Padrão simples de queue do Meta |

### Como Funciona

1. A IIFE cria a função `fbq` que enfileira comandos
2. O script `fbevents.js` é carregado assincronamente
3. Quando o script carrega, ele processa todos os comandos da fila
4. Os eventos `init`, `PageView` e `Purchase` são disparados na ordem correta

### Resultado Esperado

- Eventos serão disparados corretamente
- Advanced Matching continuará funcionando
- Sem duplicação de eventos
- Correspondência 1:1 entre logs internos e Meta Ads

