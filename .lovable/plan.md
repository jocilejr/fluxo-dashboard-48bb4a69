

## Usar templates do modal na recuperação automática de boletos

### Problema
A recuperação automática usa a mensagem da **regra** (`boleto_recovery_rules.message` + `media_blocks`), mas o usuário configura templates no modal (`boleto_recovery_templates`) com blocos de texto/PDF/imagem. Esses dois sistemas estão desconectados.

### Solução
Fazer o `auto-recovery` carregar o template padrão (ou o primeiro disponível) da tabela `boleto_recovery_templates` e usá-lo para compor a mensagem e os media attachments, em vez de usar o `message` da regra.

### Mudanças

**1) `supabase/functions/auto-recovery/index.ts`**
- No início do bloco de boleto, carregar o template padrão de `boleto_recovery_templates` (onde `is_default = true`, ou o primeiro se nenhum for default)
- Ao processar cada boleto com regra casada, iterar pelos `blocks` do template:
  - Bloco `text`: aplicar `formatMessage()` com as variáveis (`{nome}`, `{primeiro_nome}`, `{valor}`, `{vencimento}`, `{saudação}`, `{codigo_barras}`) e usar como mensagem principal
  - Bloco `pdf`: adicionar media attachment tipo `document` com o `boleto_url` do metadata
  - Bloco `image`: adicionar media attachment tipo `image` com o `boleto_url`
- Remover o uso de `matchedRule.message` e `matchedRule.media_blocks` para boletos
- Se não houver template configurado, usar fallback com a mensagem da regra (comportamento atual)

**2) `src/hooks/useBoletoRecovery.ts`**
- Na composição de `formattedMessage` para exibição na fila, também usar o template padrão da `boleto_recovery_templates` em vez da mensagem da regra
- Carregar o template padrão como query adicional e usar os blocos de texto para montar a mensagem formatada

### Fluxo resultante
```text
Template padrão (modal) → blocos [TXT, IMG, PDF]
                              ↓
auto-recovery pega template → para cada boleto:
  - TXT → formata variáveis → envia como texto
  - PDF → anexa boleto_url como document
  - IMG → anexa boleto_url como image
```

### O que NÃO muda
- A régua de regras continua controlando **quando** enviar (timing)
- O template controla **o que** enviar (conteúdo)
- Deduplicação, controle de pausa/stop, limites diários permanecem iguais

