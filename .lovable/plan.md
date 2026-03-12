
Objetivo: corrigir de forma definitiva o “abre buscador mas não digita número” com a extensão ativa 1.0.1 (legado), sem depender de troca imediata da extensão.

1) Ajustar o protocolo no app para compatibilidade com extensão 1.x e 2.x
- Arquivo: `src/hooks/useWhatsAppExtension.ts`
- Implementar envio em “camadas” para `openChat`:
  - Mensagem principal atual (`WHATSAPP_OPEN_CHAT`) com `phone` no topo e em `payload`.
  - Adicionar aliases de campo no mesmo envio (`phone`, `phoneNumber`, `number`) e `action: "OPEN_CHAT"`.
  - Se não houver resposta curta (ex.: 300–500ms), enviar fallback legado (`type: "WHATSAPP_EXTENSION_COMMAND"` + `action` + mesmos campos).
  - Fallback final opcional (`type: "OPEN_CHAT"`) para pontes antigas.
- Manter timeout total de 10s, mas com `resolved` guard para evitar múltiplas resoluções.

2) Tornar leitura de resposta robusta (sem depender de um formato único)
- Arquivo: `src/hooks/useWhatsAppExtension.ts`
- Aceitar sucesso/erro em múltiplos formatos:
  - `event.data.success`
  - `event.data.payload.success`
  - `event.data.result.success`
- Capturar erro também em múltiplos paths para log interno (`error`, `payload.error`, `result.error`).
- Ignorar mensagens próprias de ping no listener (não tratar o próprio `WHATSAPP_EXTENSION_PING` como sinal de bridge ativo).

3) Padronizar todos os fluxos de recuperação para “tentar abrir chat” mesmo sem status conectado
- Arquivos:
  - `src/components/dashboard/AbandonedEventsTab.tsx`
  - `src/components/dashboard/BoletoRecoveryQueue.tsx`
  - (já está correto em PIX/BoletoQuick, apenas revisar consistência)
- Remover bloqueio rígido `extensionStatus !== "connected"` nos fluxos manuais.
- Sempre tentar `openChat(phone)` e decidir toast pelo retorno real.
- Isso evita falso negativo com extensão 1.0.1 (que não responde ao ping novo).

4) Endurecer validação de telefone antes do envio
- Arquivo: `src/hooks/useWhatsAppExtension.ts`
- Normalizar e validar mínimo de dígitos antes de disparar comando.
- Se inválido, retornar falha imediata com erro claro (sem abrir buscador vazio).

5) (Opcional, recomendado) Compatibilização também no pacote da extensão do repositório
- Arquivos:
  - `whatsapp-extension/content-dashboard.js`
  - `whatsapp-extension/content-whatsapp.js`
- `content-dashboard.js`: extrair telefone com fallback (`payload?.phone ?? phone ?? payload?.phoneNumber ?? number`).
- `content-whatsapp.js`: abortar cedo se `phone` ausente e retornar erro explícito (evita fluxo “abre mas não digita” silencioso).
- Observação: isso melhora próximas instalações/atualizações da extensão, mas a correção principal ficará no app para funcionar com 1.0.1 já instalada.

Diagrama rápido da correção
```text
Dashboard -> Hook (multi-protocol envelope)
         -> Bridge v2 (WHATSAPP_OPEN_CHAT) OR Bridge v1 (WHATSAPP_EXTENSION_COMMAND)
         -> Background/WhatsApp content
         -> Response parser tolerante (v1/v2 formatos)
```

Validação (E2E) após implementar
- Testar em 4 fluxos: PIX/Cartão, Boleto Quick, Abandonados, Fila de Boleto.
- Em cada fluxo:
  1) clicar WhatsApp
  2) confirmar que abre “Nova conversa”
  3) confirmar que número aparece digitado no campo
  4) confirmar toast de sucesso apenas quando comando realmente retornar sucesso.
- Repetir com número em formatos diferentes: `119...`, `55119...`, `(11) 9...`.

Critério de aceite
- Com extensão 1.0.1 ativa, todos os fluxos passam a digitar o número no buscador.
- Sem regressão para bridge nova (2.x).
- Sem uso de URL direta do WhatsApp; fluxo continua 100% por manipulação DOM da extensão.
