

## Problema

O seletor de template está no componente `BoletoAutoRecoveryToggle` da página **Recuperação**, mas deveria estar no `AutoRecoveryToggleBar` da aba **Boletos Gerados** na página **Transações**. O template é usado para o envio imediato (ao receber webhook), não para o follow-up diário.

## Plano

### 1. Adicionar seletor de template ao `AutoRecoveryToggleBar` (só para tipo `boleto`)

Arquivo: `src/components/dashboard/AutoRecoveryToggleBar.tsx`

- Buscar templates de `boleto_recovery_templates` (query existente em outros componentes)
- Adicionar um `<Select>` para escolher o template padrão (quando `type === "boleto"`)
- Mutation para definir `is_default` no template selecionado

### 2. Remover seletor de template do `BoletoAutoRecoveryToggle`

Arquivo: `src/components/dashboard/BoletoAutoRecoveryToggle.tsx`

- Remover a query de templates
- Remover a mutation `setDefaultTemplate`
- Remover o bloco JSX do seletor de template (linhas ~247-267)

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/dashboard/AutoRecoveryToggleBar.tsx` | Adicionar seletor de template para tipo boleto |
| `src/components/dashboard/BoletoAutoRecoveryToggle.tsx` | Remover seletor de template |

