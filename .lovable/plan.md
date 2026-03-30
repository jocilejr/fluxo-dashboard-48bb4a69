

## Plano: Adicionar seção "Conexão de Entrada" nas configurações da API

### Problema
A tela de configurações só mostra como o dashboard se conecta à app externa. Não existe nenhum lugar que mostre à app externa **como se conectar ao dashboard** (URLs + token).

### Solução
Adicionar um novo card **"Conexão de Entrada (App Externa → Você)"** na página `ExternalApiSettings.tsx`, logo abaixo do card existente "Configuração da API Externa".

### O que o card vai mostrar

1. **URL da API REST** (copiável):
   `{SUPABASE_URL}/functions/v1/platform-api`
   - Descrição: "Use esta URL como base para consultar e criar dados (contatos, transações, lembretes, mensagens)"

2. **URL do Webhook de Entrada** (copiável):
   `{SUPABASE_URL}/functions/v1/external-messaging-webhook`
   - Descrição: "Use esta URL para enviar eventos (sync_reminder, payment_confirmed, etc.)"

3. **API Key**: mostra a mesma `api_key` já configurada acima, com botão de copiar
   - Descrição: "Envie no header `X-API-Key` em todas as requisições"

4. **Mini-documentação inline**: lista dos endpoints disponíveis e eventos aceitos (texto compacto)

### Arquivo alterado
- `src/components/settings/ExternalApiSettings.tsx` — novo card após o card de configuração existente

### Detalhes técnicos
- As URLs são construídas com `import.meta.env.VITE_SUPABASE_URL`
- A API Key é lida do state `settings.api_key` já existente
- Componente com botões de copiar (reutiliza padrão do `WebhooksSection`)
- Só exibe o card quando `settings.api_key` estiver preenchido (sem API Key não faz sentido mostrar)

