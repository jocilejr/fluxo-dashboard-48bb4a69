

## Problema

A recuperação de boletos funciona mas PIX/Cartão não abre o chat. A lógica é quase idêntica, mas há duas diferenças sutis no `PixCardQuickRecovery`:

1. **Normalização dupla do telefone**: O código faz `transaction.customer_phone.replace(/\D/g, "")` antes de passar para `openChat`, que internamente já normaliza via `normalizePhone`. O BoletoQuickRecovery passa `transaction.customer_phone!` direto (raw).

2. **Popover fecha durante operação**: `setIsOpen(false)` ao final do `handleOpenChat` desmonta o componente (e o hook `useWhatsAppExtension`) enquanto o comando ainda pode estar sendo processado. O BoletoQuickRecovery usa Dialog que permanece aberto.

## Solução

**Arquivo:** `src/components/dashboard/PixCardQuickRecovery.tsx`

Alinhar com a lógica do BoletoQuickRecovery:

1. Passar `transaction.customer_phone!` direto para `openChat` (sem `.replace()`), igual ao boleto
2. Mover `setIsOpen(false)` para depois do toast de sucesso, para não desmontar o hook antes da resposta
3. Copiar mensagem antes de abrir o chat (já faz isso, manter)

Mudança concentrada na função `handleOpenChat` (linhas 98-133).

