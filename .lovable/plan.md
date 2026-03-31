

## Corrigir contadores da recuperação de boletos — "20 contactados e 20 duplicados"

### Problema raiz

O hook `useBoletoRecovery` define `contactedTodayBoletos` como boletos com `contactedToday || duplicateToday`. Isso significa que **duplicados estao incluidos** na contagem de "contactados". Quando todos os boletos elegíveis de hoje são duplicados (porque os boletos originais que receberam mensagem já foram pagos e saíram da lista), o resultado é:

- Contactados = 20 (que são os 20 duplicados)
- Duplicados = 20

O usuário vê os mesmos 20 em ambos contadores e conclui que o sistema está bugado.

### Solução: separar em 3 contadores que somam ao total

Mostrar **três números mutuamente exclusivos**:

| Contador | Significado | Filtro |
|---|---|---|
| **Enviados** | Mensagem realmente enviada | `contactedToday && !duplicateToday` |
| **Duplicados** | Telefone já contactado hoje, pulado | `duplicateToday` |
| **Pendentes** | Aguardando processamento | `!contactedToday && !duplicateToday` |

Progresso = (enviados + duplicados) / total

### Arquivos e mudanças

#### 1) `src/hooks/useBoletoRecovery.ts`
- Renomear `contactedTodayBoletos` para **`resolvedTodayBoletos`** (sent + duplicate)
- Adicionar `sentTodayBoletos` = filter(`contactedToday && !duplicateToday`)
- Stats passa a ter:
  - `sentToday` (mensagens realmente enviadas)
  - `duplicatesToday` (pulados por telefone)
  - `resolvedToday` = sentToday + duplicatesToday
  - `pendingToday` (sem nenhum log)

#### 2) `src/components/dashboard/BoletoRecoveryHeroCard.tsx`
- Trocar props para receber `sentToday`, `duplicatesToday`, `resolvedToday`, `pendingToday`, `totalToday`
- Chip "Enviados" (verde): `sentToday`
- Chip "Duplicados" (amarelo): `duplicatesToday`
- Progresso: `resolvedToday / totalToday`
- Texto: "X boletos aguardando contato" usa `pendingToday`

#### 3) `src/components/dashboard/BoletoRecoveryDashboard.tsx`
- Passar as novas props ao HeroCard

### O que NÃO muda
- Backend (auto-recovery) permanece igual
- Lógica de regras, deduplicação, fila de envio — tudo igual
- Apenas a **apresentação** dos números na UI

