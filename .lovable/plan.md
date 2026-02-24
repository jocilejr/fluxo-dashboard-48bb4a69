

# Corrigir Notificações Web e Atualizações em Tempo Real

## Problema Identificado

O componente `NotificationPopup` existe no projeto (`src/components/layout/NotificationPopup.tsx`) mas **nao esta sendo renderizado** em nenhum lugar do layout. O `AppLayout.tsx` chama `useTransactions()` mas so usa `transactions`, ignorando `notifications`, `dismissNotification` e `dismissAllNotifications`.

Alem disso, o `pageConfig` no `AppLayout.tsx` ainda referencia a rota `/navegador` que foi removida.

## Plano de Correção

### 1. Atualizar `src/components/AppLayout.tsx`

- Importar o componente `NotificationPopup` de `@/components/layout/NotificationPopup`
- Desestruturar `notifications` e `dismissAllNotifications` do hook `useTransactions()`
- Renderizar o `NotificationPopup` no header, ao lado do indicador de notificações existente (substituindo o badge simples atual)
- Remover a entrada `/navegador` do `pageConfig`

### Detalhes Tecnicos

No `AppLayout.tsx`:

1. Adicionar import: `import { NotificationPopup } from "@/components/layout/NotificationPopup";`
2. Mudar linha 139 de:
   - `const { transactions } = useTransactions();`
   - para: `const { transactions, notifications, dismissAllNotifications } = useTransactions();`
3. Substituir o badge simples de notificacoes (linhas 268-278) pelo componente `NotificationPopup`:
   - `<NotificationPopup notifications={notifications} onDismiss={dismissAllNotifications} />`
4. Remover a linha `/navegador` do `pageConfig` (linha 130)

