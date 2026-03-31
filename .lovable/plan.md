

## Reformulação completa da Recuperação de Boletos

### Visão geral
Reescrever do zero a lógica de recuperação de boletos — backend, hook e layout. A nova arquitetura será simples: o backend consulta boletos não pagos, aplica as regras da régua, e gera uma lista de "tarefas do dia" com a mensagem já pronta. O frontend apenas exibe essa lista.

### Arquitetura nova

```text
┌─────────────────────────────────────────────┐
│  boleto_recovery_rules (banco)              │
│  ─ rule_type: days_after_generation         │
│  ─ days: N                                  │
│  ─ message: template com variáveis          │
│  ─ media_blocks, is_active, priority        │
└──────────────┬──────────────────────────────┘
               │
   ┌───────────▼───────────────┐
   │  auto-recovery (backend)  │
   │                           │
   │  1. Busca boletos não     │
   │     pagos com telefone    │
   │  2. Para cada boleto,     │
   │     calcula dias desde    │
   │     geração (fuso BR)     │
   │  3. Verifica qual regra   │
   │     casa (days_after_gen) │
   │  4. Checa message_log     │
   │     para dedup do dia     │
   │  5. Envia mensagem        │
   │  6. Registra no           │
   │     message_log           │
   └───────────┬───────────────┘
               │
   ┌───────────▼───────────────┐
   │  Frontend (hook + page)   │
   │                           │
   │  Fonte de verdade:        │
   │  message_log (sent hoje)  │
   │  = contactados            │
   │                           │
   │  Pendentes do dia:        │
   │  boletos que casam regra  │
   │  mas NÃO estão no log    │
   └───────────────────────────┘
```

### O que será feito

#### 1. Nova edge function `auto-recovery/index.ts` — seção boleto reescrita do zero

**Lógica simplificada (sem IFs aninhados):**
- Buscar todas as regras ativas (`rule_type != 'immediate'`), ordenadas por prioridade
- Buscar todos os boletos não pagos com telefone
- Buscar TODOS os registros de `message_log` de hoje (`message_type = 'boleto'`, `status = 'sent'`) de uma vez — criar um `Map<transaction_id, count>`
- Para cada boleto:
  - Calcular `daysSinceGeneration` usando fuso de Brasília (função única e clara)
  - Encontrar a primeira regra que casa com `daysSinceGeneration`
  - Se já existe log para esse `transaction_id` + essa regra hoje → skip
  - Checar limite por pessoa/dia usando últimos 8 dígitos do telefone
  - Enviar mensagem e registrar em `message_log`
- **Não usar `boleto_recovery_contacts`** para dedup automática — usar apenas `message_log` como fonte de verdade
- Manter PIX/Card e Abandoned como estão (sem mudança)

**Mudanças chave:**
- Uma única função `calcDaysSinceGeneration(createdAt: string): number` que faz tudo em Brasília
- Pre-load de todos os logs do dia em memória (1 query) ao invés de N queries dentro do loop
- Remover toda lógica de `boleto_recovery_contacts` do fluxo automático
- Salvar `rule_id` no `message_log` (novo campo) para saber qual regra foi aplicada

#### 2. Migration SQL — adicionar `rule_id` ao `message_log`

```sql
ALTER TABLE public.message_log ADD COLUMN IF NOT EXISTS rule_id uuid;
```

Isso permite rastrear qual regra gerou cada envio, facilitando a dedup e a contagem.

#### 3. Novo hook `useBoletoRecovery.ts` — reescrito do zero

**Dados:**
- Query 1: boletos não pagos (paginado, como hoje)
- Query 2: regras ativas
- Query 3: `message_log` de hoje com `message_type = 'boleto'` e `status = 'sent'` — retorna `transaction_id` e `rule_id`
- Query 4: `boleto_settings` (dias de vencimento)

**Processamento (1 único `useMemo`):**
- Para cada boleto, calcular `daysSinceGeneration` (mesmo cálculo do backend)
- Encontrar a regra que casa
- Checar se já tem log hoje para esse `transaction_id` → se sim, `contacted = true`
- Gerar `formattedMessage` com as variáveis substituídas

**Stats simples:**
- `totalDoDia` = boletos que casam com alguma regra hoje
- `contactados` = desses, quantos têm registro em `message_log` hoje
- `pendentes` = `totalDoDia - contactados`

**Realtime:** subscription em `message_log` e `transactions` para invalidar queries.

#### 4. Nova página `Recuperacao.tsx` — layout redesenhado

Layout limpo com 3 seções:

**Seção 1 — Barra de automação (BoletoAutoRecoveryToggle)**
- Mantém funcionalidade atual: switch, instância, horário, ritmo de envio
- Sem mudanças significativas

**Seção 2 — Card resumo do dia**
- Mostra: Total do dia | Contactados | Pendentes | Valor total
- Barra de progresso
- Botão "Iniciar Recuperação" (abre fila manual)
- Botão "Configurar Régua"

**Seção 3 — Lista do dia**
- Tab única "Hoje" como principal (focus do dia)
- Cada card mostra: nome, telefone, valor, regra aplicada, mensagem preview
- Badge "Enviado" se já está no `message_log`
- Badge "Pendente" se ainda não
- Tabs secundárias: Pendentes (não vencidos), Vencidos, Todos

#### 5. Componente `BoletoRecoveryRulesConfig.tsx` — manter como está
- Apenas `days_after_generation`, `days_before_due`, `days_after_due`
- Já funciona bem, sem mudanças

### Fonte de verdade única: `message_log`

- **Contactados** = registros em `message_log` de hoje com `message_type = 'boleto'` e `status = 'sent'`
- **Bloqueio de reenvio** = se já existe log para o `transaction_id` hoje, não envia novamente
- **Limite por pessoa** = contar logs de hoje por últimos 8 dígitos do telefone
- `boleto_recovery_contacts` continua existindo para contatos manuais mas **não interfere** na contagem automática

### Arquivos modificados
- `supabase/functions/auto-recovery/index.ts` — reescrever seção boleto (linhas 288-477)
- `src/hooks/useBoletoRecovery.ts` — reescrever do zero
- `src/pages/Recuperacao.tsx` — novo layout
- `src/components/dashboard/BoletoRecoveryHeroCard.tsx` — simplificar props
- `src/components/dashboard/BoletoRecoveryDashboard.tsx` — simplificar lógica
- Migration: adicionar coluna `rule_id` em `message_log`

### Resultado
- Uma função de cálculo de dias única e compartilhada (backend = frontend)
- Sem IFs aninhados confusos
- Contagem baseada em uma fonte só (`message_log`)
- Atualização em tempo real via realtime subscription
- Layout limpo focado no dia atual

