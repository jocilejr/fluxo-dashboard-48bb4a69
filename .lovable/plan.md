

## Plano: Redesign de Lembretes + Sync bidirecional com API externa

### 1. Migração: adicionar `external_id` na tabela reminders

Adicionar coluna `external_id text` para mapear lembretes locais aos IDs da API externa. Isso permite enviar updates de volta à API ao marcar como concluído.

Atualizar `sync-reminders` para salvar o `external_id` (campo `id` ou `_id` do response da API) durante a importação.

### 2. Toggle concluído: sync com API externa

No `toggleMutation` do frontend:
- Atualizar localmente no banco
- Chamar `supabase.functions.invoke('external-reminders', { body: { action: 'update', reminder_id: external_id, completed: true/false } })` para sincronizar com a API externa
- Se o lembrete não tiver `external_id`, só atualiza localmente

### 3. Redesign do layout (baseado na imagem de referência)

Novo layout com:
- **Header**: titulo + subtitulo à esquerda, botão "+ Novo Lembrete" à direita
- **4 stat cards** em linha: Atrasados (vermelho), Para hoje (amarelo), Pendentes (laranja), Concluídos (verde) -- cada um clicável como filtro
- **Corpo**: grid de 2 colunas
  - **Esquerda**: Calendário mensal com indicadores verdes nos dias que têm lembretes. Clicar num dia filtra os lembretes daquele dia
  - **Direita**: Lista de lembretes do dia/filtro selecionado, agrupados por data. Cada card mostra: badges (Hoje, categoria), nome do contato, telefone, descrição, horário, botão concluir (circle) e deletar (trash)

### Detalhes técnicos

**Migração SQL:**
```sql
ALTER TABLE public.reminders ADD COLUMN external_id text;
CREATE INDEX idx_reminders_external_id ON public.reminders(external_id);
```

**sync-reminders/index.ts:**
- Salvar `reminder.id || reminder._id` como `external_id` no insert/update
- Usar `external_id` para deduplicação em vez de phone+title

**external-reminders/index.ts:**
- Já tem action `update` com PATCH -- sem mudanças necessárias

**Lembretes.tsx:**
- Query principal busca todos os reminders (sem filtro de status no query, filtra no frontend para contar stats)
- State `selectedDate` para o calendário
- Componente calendário usando date-fns para renderizar dias do mês
- Stat cards calculados a partir dos dados

**Arquivos modificados:**
1. Nova migração SQL (adicionar `external_id`)
2. `supabase/functions/sync-reminders/index.ts` (salvar external_id)
3. `src/pages/Lembretes.tsx` (redesign completo + sync ao concluir)

