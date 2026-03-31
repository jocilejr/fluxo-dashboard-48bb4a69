

## Concluído: Revertido auto-recovery para usar mensagem da regra

- Auto-recovery usa `matchedRule.message` + `matchedRule.media_blocks` (como antes)
- `useBoletoRecovery.ts` usa `applicableRule.message` para `formattedMessage`
- Removidas queries de `boleto_recovery_templates` de ambos os arquivos
- `BoletoQuickRecovery` / modal continuam usando templates separadamente
