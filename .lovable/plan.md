

## Corrigir duplicados contarem como contactados + resolver pendentes não enviados

### Mudança 1: Duplicados contam como "Contactados" na UI

**Problema:** Duplicados aparecem como contador separado, mas o usuário quer que eles também entrem no total de "Contactados".

**Arquivos:**
- `src/components/dashboard/BoletoRecoveryHeroCard.tsx` — O chip "Contactados" deve mostrar `contactedToday + duplicatesToday` / total. Manter o chip "Duplicados" visível ao lado, mas como sub-contagem informativa.
- `src/hooks/useBoletoRecovery.ts` — O `contactedTodayBoletos` deve incluir os duplicados. Ajustar para: `contactedTodayBoletos = filter(b.contactedToday || b.duplicateToday)`. O `pendingTodayBoletos` já exclui ambos (está correto). Stats: `contactedToday = contacted + duplicates`.

### Mudança 2: Backend — ordenação estável para self-continuation

**Problema:** A query de boletos no backend (`supabase/functions/auto-recovery/index.ts` linha 393-398) não tem `order()`. Quando a função usa self-continuation com `_continueFrom` (offset), sem ordenação determinística os itens podem mudar de posição entre invocações, causando boletos pulados.

**Correção:** Adicionar `.order('created_at', { ascending: true }).order('id', { ascending: true })` na query dos boletos.

### Mudança 3: Backend — paginar boletos além de 1000

**Problema:** Supabase retorna no máximo 1000 linhas por query. Se houver mais de 1000 boletos não pagos, parte deles nunca será processada.

**Correção:** Usar loop de paginação na query de boletos (similar ao que o frontend já faz no hook `useBoletoRecovery`).

### Mudança 4: Backend — incluir `duplicate` logs na query `todayLogs`

**Problema:** O backend busca apenas `status: 'sent'` nos logs de hoje (linha 410). Duplicados registrados em runs anteriores não são considerados, então o mesmo boleto pode ser processado como duplicado novamente a cada continuation.

**Correção:** Buscar `.in('status', ['sent', 'duplicate'])` para que duplicados já registrados não sejam reprocessados.

### Resumo dos arquivos

| Arquivo | O que muda |
|---|---|
| `src/hooks/useBoletoRecovery.ts` | `contactedTodayBoletos` inclui duplicados; stats ajustado |
| `src/components/dashboard/BoletoRecoveryHeroCard.tsx` | "Contactados" mostra sent+duplicates; chip duplicados mantido como info |
| `supabase/functions/auto-recovery/index.ts` | Ordenação estável na query; paginação; todayLogs inclui duplicates |

### O que NÃO muda
- A lógica de timing da régua
- O BoletoQuickRecovery / modal manual
- Pausa/stop/continuação
- O chip "Duplicados" continua visível como sub-contagem

