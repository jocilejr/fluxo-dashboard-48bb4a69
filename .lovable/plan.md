

## Plano: Mensagens de recuperação inline + automação por tipo

### Contexto
Atualmente as mensagens de recuperação estão em modais separados (`AbandonedRecoverySettings`, `PixCardRecoverySettings`, `BoletoRecoveryRulesConfig`). O usuário quer:
1. Configurar mensagens diretamente na página **Auto Rec.**
2. Dois modos de automação distintos:
   - **PIX/Cartão e Abandonos**: recuperação automática disparada quando chega transação nova (via webhook)
   - **Boletos**: recuperação automática diária via cron job

### Alterações

#### 1. Página Auto Rec. — Mensagens inline
**Arquivo: `src/pages/AutoRecuperacao.tsx`**
- Adicionar dentro de cada `InstanceCard` (ou abaixo dele) um campo `Textarea` para editar a mensagem de cada tipo:
  - **PIX/Cartão**: carrega/salva de `pix_card_recovery_settings.message`
  - **Abandonos**: carrega/salva de `abandoned_recovery_settings.message`
  - **Boleto**: link para a régua de cobrança (já tem múltiplas regras com mensagens individuais) — exibir um resumo das regras e botão para expandir o `BoletoRecoveryRulesConfig` inline
- Mostrar as variáveis disponíveis: `{saudação}`, `{nome}`, `{primeiro_nome}`, `{valor}`, `{produto}`
- Queries: `pix-card-recovery-settings`, `abandoned-recovery-settings`; mutations para update/insert

#### 2. Recuperação automática por transação nova (PIX/Cartão + Abandonos)
**Arquivo: `supabase/functions/webhook-receiver/index.ts`** (ou `external-messaging-webhook`)
- Quando chega um evento de transação nova (PIX/cartão pendente) ou abandono, após salvar no banco, invocar automaticamente `auto-recovery` passando `{ type: 'pix_card', transactionId }` ou `{ type: 'abandoned', abandonedEventId }`
- Checar se a recuperação está habilitada (`pix_card_recovery_enabled` / `abandoned_recovery_enabled`) antes de invocar
- Isso garante recuperação em tempo real para transações novas

#### 3. Recuperação diária de boletos via cron
**Migração SQL (via insert tool, não migration)**:
- Habilitar extensões `pg_cron` e `pg_net` (se ainda não habilitadas)
- Criar cron job que roda 1x por dia (ex: `0 9 * * *` — 9h da manhã) chamando a edge function `auto-recovery` com `{ type: 'boleto' }`
- Usar `net.http_post` com a URL da function e o anon key

#### 4. Indicadores visuais na página Auto Rec.
- Mostrar badge "Tempo Real" nos cards PIX/Cartão e Abandonos (indicando que disparam por webhook)
- Mostrar badge "Diário 9h" no card Boleto (indicando que roda via cron)
- Seção de descrição explicativa em cada card

#### 5. Refatorar edge function `auto-recovery`
**Arquivo: `supabase/functions/auto-recovery/index.ts`**
- Aceitar parâmetros opcionais `transactionId` e `abandonedEventId` para processar um item específico (modo webhook)
- Quando recebe ID específico, processar apenas aquele item sem loop
- Manter o modo batch existente para o cron de boletos

### Resultado
- **PIX/Cartão + Abandonos**: recuperação automática instantânea quando a transação/abandono chega via webhook
- **Boletos**: recuperação automática diária via cron job às 9h
- **Mensagens**: configuráveis diretamente na página Auto Rec. sem precisar de modais separados

