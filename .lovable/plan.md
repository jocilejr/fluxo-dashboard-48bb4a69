

## Plano: Redesign limpo da página Auto Rec.

### Problema
A página tem 7 cards empilhados verticalmente sem hierarquia clara. Muita repetição visual, informações espalhadas, e o botão "Salvar" fica perdido no final junto com execução manual.

### Redesign

#### Estrutura nova
1. **Header** com título + subtítulo + botão "Salvar" fixo no topo (sempre visível)
2. **Stats em linha** logo abaixo do header (5 mini-stats horizontais, sem card wrapper)
3. **3 cards de recuperação** lado a lado em grid `md:grid-cols-3` — cada um contendo:
   - Switch de ativação no header
   - Badge de tipo (Tempo Real / Diário 9h)
   - Seletor de instância
   - Textarea da mensagem
   - Para Boleto: inclui `BoletoRecoveryRulesConfig` no lugar do textarea simples
4. **Card "Configurações Gerais"** abaixo do grid, com limites + horário comercial em uma linha compacta
5. **Seção "Execução Manual"** como uma barra simples com botões inline, sem card separado

#### Detalhes visuais
- Remover card wrapper dos stats (usar divs simples com fundo sutil)
- Alinhar botão "Salvar" no header ao lado do título
- Cards de recuperação com altura equilibrada usando flex-grow
- Variáveis disponíveis compactadas em uma única linha de badges pequenos
- Warning de API não configurada como banner fino no topo

#### Arquivo alterado
- `src/pages/AutoRecuperacao.tsx` — rewrite completo do JSX

