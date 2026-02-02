
## Remover Fallback de Imagem do Meta Pixel

### Problema Atual
O sistema está disparando o evento de duas formas simultaneamente:
1. Via JavaScript (`fbq('track', 'Purchase')`)
2. Via tag `img` como fallback

Isso causa **duplicação de eventos** no Meta Ads (8 acessos = 12 eventos).

### Solução
Remover completamente o fallback via `img` tag, mantendo apenas o disparo via JavaScript.

### Alterações Técnicas

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/EntregaPublica.tsx` | Remover bloco de código que cria e dispara a tag `img` fallback |

### Código a Remover (linhas 143-153)

```javascript
// REMOVER TODO ESTE BLOCO:
const img = document.createElement('img');
img.height = 1;
img.width = 1;
img.style.display = 'none';
img.setAttribute('alt', '');
const timestamp = Date.now();
const phoneParam = formattedPhone ? `&ud[ph]=${formattedPhone}` : '';
img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=${encodeURIComponent(eventName || 'Purchase')}&cd[value]=${value}&cd[currency]=BRL${phoneParam}&noscript=1&_t=${timestamp}`;
document.body.appendChild(img);
console.log(`[Pixel] Meta img fallback fired for ${pixelId} with Advanced Matching`);
```

### Resultado Esperado
- Apenas 1 evento por acesso no Meta Ads
- Correspondência de 1:1 entre logs internos e eventos no Meta
- Advanced Matching continua funcionando via JavaScript
