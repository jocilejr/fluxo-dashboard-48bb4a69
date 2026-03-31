

## Adicionar ícone de configurações de throttling na recuperação de boleto

### O que será feito

Adicionar um botão de engrenagem (⚙️) no card `BoletoAutoRecoveryToggle` que abre um **Popover** com configurações de ritmo de envio:

1. **Delay entre mensagens** — campo numérico (segundos entre cada mensagem). Já existe a coluna `delay_between_messages` em `messaging_api_settings`.
2. **Pausa em lote** — a cada X mensagens, pausar Y segundos antes de continuar. Requer **2 novas colunas** na tabela `messaging_api_settings`:
   - `batch_size` (integer, default 10) — quantidade de mensagens antes da pausa
   - `batch_pause_seconds` (integer, default 30) — duração da pausa em segundos

### Arquivos modificados

1. **Migration SQL** — adicionar colunas `batch_size` e `batch_pause_seconds` em `messaging_api_settings`

2. **`src/components/dashboard/BoletoAutoRecoveryToggle.tsx`**
   - Adicionar ícone `Settings` (lucide) ao lado do horário, visível quando automação ativa
   - Ao clicar, abre um `Popover` com:
     - Input "Delay entre mensagens" (segundos) → salva em `delay_between_messages`
     - Input "A cada X mensagens" → salva em `batch_size`
     - Input "Pausar por Y segundos" → salva em `batch_pause_seconds`
   - Salva instantaneamente via mutation existente

3. **`supabase/functions/auto-recovery/index.ts`**
   - No loop de envio de boletos, após enviar `batch_size` mensagens, adicionar `await sleep(batch_pause_seconds * 1000)` antes de continuar

### Resultado
O admin controla o ritmo de envio direto no card de automação da Recuperação, evitando bloqueios por envio em massa.

