

## Problema

Na recuperação diária (régua de cobrança), quando a regra tem o bloco de **imagem** habilitado, o sistema envia a URL do PDF diretamente com `type: 'image'`. O WhatsApp não renderiza PDFs como imagem. A função `convertPdfToImageUrl()` já existe no código mas só é chamada no envio imediato.

## Solução

No arquivo `supabase/functions/auto-recovery/index.ts`, na seção "BATCH: BOLETO recovery (drip/follow-up)" (linhas ~792-801), antes de montar o array `boletoMedia`, converter o PDF em imagem usando `convertPdfToImageUrl()` quando o bloco de imagem estiver habilitado.

### Alteração

Arquivo: `supabase/functions/auto-recovery/index.ts`

Na seção de construção de mídia da régua diária (~linha 792):

1. Verificar se existe bloco de imagem habilitado
2. Se sim, chamar `convertPdfToImageUrl(boletoUrl, supabase)` para converter
3. Usar a URL da imagem convertida no `media_url` em vez da URL do PDF
4. Se a conversão falhar, fazer fallback para envio como documento

```text
Antes (linha ~798):
  if (mediaBlocks.find(b => b.type === 'image')?.enabled) {
    boletoMedia.push({ media_url: boletoUrl, type: 'image', ... });
  }

Depois:
  if (mediaBlocks.find(b => b.type === 'image')?.enabled) {
    const imgUrl = await convertPdfToImageUrl(boletoUrl, supabase);
    if (imgUrl) {
      boletoMedia.push({ media_url: imgUrl, type: 'image', ... });
    } else {
      // Fallback: send as document
      boletoMedia.push({ media_url: boletoUrl, type: 'document', ... });
    }
  }
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/auto-recovery/index.ts` | Chamar `convertPdfToImageUrl` na régua diária para blocos de imagem |

