

## Plano: Corrigir posição do seletor de template de boleto

### Problema
O seletor de template foi colocado na **barra de automação de recuperação** (`BoletoAutoRecoveryToggle`), quando deveria estar no **modal de config de Boleto Ger. em Transações** (`BoletoRecoveryModal`).

### Mudanças

**1. Remover seletor de template do `BoletoAutoRecoveryToggle.tsx`**
- Remover a query `boleto-recovery-templates-list`
- Remover a função `setDefaultTemplate`
- Remover o bloco JSX do `Select` de templates
- Remover imports não utilizados (`FileText`, `Select`, etc.)

**2. Adicionar seletor de template ativo no `BoletoRecoveryModal.tsx`**
- No sidebar de templates (à esquerda), ao lado do botão de "Definir como padrão" (estrela), deixar mais visível qual é o template ativo/padrão
- Adicionar um destaque claro no template que está marcado como `is_default` — esse é o que será usado para envio imediato de boletos
- Adicionar texto explicativo: "O template padrão (★) será usado no envio automático de boletos"

Isso mantém toda a gestão de templates (criar, editar, selecionar o ativo) dentro do modal correto, que é o de **Transações > Boleto Ger. > Config**.

