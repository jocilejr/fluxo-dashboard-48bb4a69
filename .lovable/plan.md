

## Remover Auto Rec e integrar toggles nas abas de Transações e Recuperação

### Situação atual
- Existe uma página separada **Auto Rec.** (`/auto-recuperacao`) com abas PIX/Cartão, Abandonos, Logs e Config
- A página **Transações** tem abas: Aprovados, Boletos Ger., PIX/Cartão Pend., Abandono/Falha
- A página **Recuperação** já tem o `BoletoAutoRecoveryToggle`
- As mensagens automáticas estão em `messaging_api_settings` (tabela centralizada)
- As mensagens manuais estão em `pix_card_recovery_settings` e `abandoned_recovery_settings`

### O que muda

#### 1. Remover a página Auto Rec.
- Remover rota `/auto-recuperacao` do `App.tsx`
- Remover import lazy de `AutoRecuperacao`
- Remover item "Auto Rec." do `AppSidebar.tsx` (navItems)
- O arquivo `AutoRecuperacao.tsx` pode ser mantido, mas fica órfão

#### 2. Adicionar toggles de auto-recovery nas abas de Transações (admin only)
Na `TransactionsTable.tsx`, quando o admin está na aba **"Boletos Ger."**, **"PIX/Cartão Pend."** ou **"Abandono/Falha"**, exibir um toggle compacto para ativar/desativar a automação correspondente:

- **Boletos Ger.**: toggle `boleto_recovery_enabled` + seletor de instância `boleto_instance_name`
- **PIX/Cartão Pend.**: toggle `pix_card_recovery_enabled` + seletor de instância `pix_card_instance_name`
- **Abandono/Falha**: toggle `abandoned_recovery_enabled` + seletor de instância `abandoned_instance_name`

Criar um componente **`AutoRecoveryToggleBar`** que:
- Recebe `type` (boleto/pix_card/abandoned)
- Lê `messaging_api_settings`
- Exibe switch + instância inline
- Salva instantaneamente via mutation
- Visível apenas para admins (`isAdmin` prop)

#### 3. Usar mensagem da transação manual para envio automático
A automação passa a utilizar as mensagens configuradas nos modais de recuperação manual:
- **PIX/Cartão**: lê de `pix_card_recovery_settings.message`
- **Abandonos**: lê de `abandoned_recovery_settings.message`
- **Boletos**: já usa a régua de cobrança (sem mudança)

Atualizar a edge function `auto-recovery/index.ts`:
- No fluxo **pix_card**: buscar mensagem de `pix_card_recovery_settings` em vez de `messaging_api_settings.auto_pix_card_message`
- No fluxo **abandoned**: buscar mensagem de `abandoned_recovery_settings` em vez de `messaging_api_settings.auto_abandoned_message`

#### 4. Recuperação de Boletos
Já tem o `BoletoAutoRecoveryToggle` — sem mudança.

#### 5. Mover Logs e Config
As abas "Logs" e "Config" da Auto Rec. ficam acessíveis em **Configurações** ou podem ser adicionadas como sub-seção na página de Configurações (decisão a tomar). Alternativamente, manter os logs acessíveis via a página de Recuperação.

### Arquivos modificados
- `src/App.tsx` — remover rota `/auto-recuperacao`
- `src/components/AppSidebar.tsx` — remover item "Auto Rec."
- `src/components/dashboard/TransactionsTable.tsx` — adicionar `AutoRecoveryToggleBar` por aba (admin only)
- `src/components/dashboard/AutoRecoveryToggleBar.tsx` — novo componente compacto
- `supabase/functions/auto-recovery/index.ts` — usar mensagens das tabelas manuais para pix_card e abandoned
- Opcionalmente integrar Logs/Config na página de Configurações ou Recuperação

### Resultado
A página Auto Rec. deixa de existir. Os toggles de automação ficam diretamente nas abas de Transações (admin only), e a recuperação de boletos mantém seu toggle na página Recuperação. As mensagens automáticas passam a usar os templates configurados nos modais de recuperação manual.

