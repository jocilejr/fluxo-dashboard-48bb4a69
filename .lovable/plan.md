

## Plano: Remover card de Conexão de Entrada e exposição de URLs/API

### O que será feito

**Arquivo: `src/components/settings/ExternalApiSettings.tsx`**

1. **Remover a linha 444** que renderiza o `InboundConnectionCard`:
   ```
   {settings.api_key && <InboundConnectionCard apiKey={settings.api_key} />}
   ```

2. **Remover o componente `InboundConnectionCard`** inteiro (linhas 542-663)

3. **Remover imports não usados**: `Copy`, `Check`, `Globe`, `Webhook` (que só eram usados pelo card removido)

4. **Remover a exposição de URLs na seção "Externa → Dashboard"** dentro do `DataSyncSection` (linhas 523-535) — remover o bloco que mostra a URL do webhook e lista de eventos aceitos

### O que permanece
- Card "Configuração da API Externa" (server_url, api_key, webhook_url, testar conexão)
- Card "Recuperação Automática"
- Card "Sincronização de Dados" — apenas o lado "Dashboard → Externa" (botões de sync de clientes e transações)
- Message Logs

