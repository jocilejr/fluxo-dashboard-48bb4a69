

## Unificar Auto Rec de Boleto na página de Recuperação

### Situação atual
- A página **Recuperação** (`/recuperacao`) tem a fila manual de boletos + régua de cobrança
- A página **Auto Rec.** (`/auto-recuperacao`) tem uma aba "Boleto" separada com: toggle de ativação, seletor de instância, horário de envio e a mesma régua de cobrança duplicada
- O usuário precisa navegar entre duas páginas para configurar algo que deveria estar junto

### O que muda

#### 1. Página Recuperação (`src/pages/Recuperacao.tsx`)
Adicionar no topo (acima do `BoletoRecoveryHeroCard`) um card compacto de **automação** com:
- **Switch** para ativar/desativar `boleto_recovery_enabled` (salva direto em `messaging_api_settings`)
- **Seletor de instância** inline (mesmo chip compacto usado na Auto Rec)
- **Horário de envio** (input numérico `boleto_send_hour`)
- Quando ativo, exibe indicador verde "Automação ativa — disparo diário às Xh"
- Quando inativo, exibe texto cinza "Automação desativada"

Tudo salva instantaneamente em `messaging_api_settings`, sem botão de salvar separado.

#### 2. Página Auto Rec. (`src/pages/AutoRecuperacao.tsx`)
- **Remover** a aba "Boleto" das tabs (de 5 abas para 4)
- Ajustar o `grid-cols` de 5 para 4
- Remover todo o `TabsContent value="boleto"`

#### 3. Componente novo: `BoletoAutoRecoveryToggle`
Componente compacto (`src/components/dashboard/BoletoAutoRecoveryToggle.tsx`) que:
- Lê `messaging_api_settings` (query `messaging-api-settings`)
- Exibe switch + instância + horário em uma linha
- Salva via mutation diretamente
- Usa o `InstanceSelectorModal` existente

### Nenhuma alteração no backend
A edge function `auto-recovery` já usa `messaging_api_settings` e a régua de cobrança. Apenas a UI está sendo reorganizada.

### Resultado
A página Recuperação passa a ser o ponto único para gerenciar boletos — tanto a fila manual quanto a automação. A Auto Rec. fica focada em PIX/Cartão e Abandonos.

