
Objetivo: fazer os lembretes atualizarem automaticamente quando forem alterados na aplicação externa, sem depender do botão Importar nem do cron de 15 minutos.

1. Confirmar a causa e preservar o que já funciona
- Manter a subscription realtime em `src/pages/Lembretes.tsx`, porque ela já atualiza a tela imediatamente quando o banco local muda.
- O problema real é anterior à UI: hoje a aplicação externa não envia mudanças de lembretes para o banco local.
- A análise do código mostrou que:
  - `sync-reminders` apenas busca a API externa por polling/importação.
  - `external-messaging-webhook` aceita clientes, transações e abandono, mas não aceita eventos de lembretes.
  - Portanto, mudanças feitas no sistema externo não entram no banco em tempo real.

2. Adicionar suporte a webhook de lembretes no backend
- Atualizar `supabase/functions/external-messaging-webhook/index.ts` para aceitar novos eventos de lembrete, por exemplo:
  - `sync_reminder`
  - `reminder_updated`
  - opcionalmente `reminder_deleted`
- Para criação/atualização:
  - localizar por `external_id`
  - fazer upsert dos campos `title`, `description`, `phone`, `due_date`, `completed`, `updated_at`
  - normalizar telefone como já é feito em outros fluxos
- Para exclusão:
  - remover do banco local pelo `external_id`, ou marcar como concluído/inativo se preferir comportamento mais seguro

3. Tornar o webhook compatível com payloads variáveis
- Aceitar aliases usados pela API externa, por exemplo:
  - `id` ou `_id` para `external_id`
  - `phone`, `phone_number` ou `remote_jid`
  - `due_date` ou `dueDate`
- Tratar faltas de campos com fallback seguro para evitar falhas silenciosas.
- Registrar logs claros no backend para facilitar debug quando o payload vier incompleto.

4. Expor isso também na documentação/configuração da integração
- Atualizar `src/components/settings/ExternalApiSettings.tsx` para mostrar que o webhook unificado também aceita eventos de lembrete.
- Incluir no texto de ajuda os eventos esperados e um exemplo de payload para a aplicação externa configurar corretamente.

5. Ajustar a estratégia de sincronização
- Manter `sync-reminders` como fallback/recuperação periódica.
- Deixar claro na implementação que:
  - webhook = atualização imediata
  - sync = reconciliação/backup
- Assim, se algum webhook falhar, o cron ainda corrige divergências depois.

6. Resultado esperado
- Quando o lembrete for alterado na aplicação externa:
  - a aplicação externa chama o webhook de lembretes
  - o banco local é atualizado na hora
  - o realtime da tabela `reminders` dispara
  - a tela `/lembretes` reflete a mudança sem refresh manual

Detalhes técnicos
- Arquivos a alterar:
  - `supabase/functions/external-messaging-webhook/index.ts`
  - `src/components/settings/ExternalApiSettings.tsx`
- Não parece necessária nova migração para isso.
- O botão Importar e o cron continuam úteis como redundância, mas deixam de ser o mecanismo principal para “tempo real”.
- Observação importante: sem configurar a aplicação externa para realmente enviar o webhook de lembretes, nenhuma mudança ficará instantânea. O realtime no frontend sozinho não resolve isso, porque ele só escuta o banco local.

Fluxo proposto
```text
Aplicação externa
   -> POST /functions/v1/external-messaging-webhook
      event: sync_reminder / reminder_updated
   -> banco local reminders atualizado
   -> realtime postgres_changes
   -> React Query invalida ["reminders"]
   -> UI atualiza automaticamente
```
