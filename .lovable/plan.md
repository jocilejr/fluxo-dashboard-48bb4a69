

## Plano: Sistema de seleção de instância WhatsApp por tipo de recuperação

### Problema
A API externa exige o campo `instance` em todas as chamadas de envio. Hoje não existe forma de escolher qual instância WhatsApp usar para cada tipo de recuperação (Boleto, PIX/Cartão, Abandono).

### Solução
Criar um sistema onde cada tipo de recuperação tem uma instância vinculada. Na seção "Recuperação Automática" das configurações, cada card (Boleto, PIX/Cartão, Abandonos) ganha um botão para abrir um modal que busca as instâncias disponíveis na API externa (`GET /api/platform/fetch-instances`) e permite vincular uma.

### Alterações

**1. Migração SQL: adicionar colunas de instância na tabela `messaging_api_settings`**
- `boleto_instance_name TEXT DEFAULT NULL`
- `pix_card_instance_name TEXT DEFAULT NULL`
- `abandoned_instance_name TEXT DEFAULT NULL`

**2. Arquivo: `src/components/settings/ExternalApiSettings.tsx`**
- Adicionar as 3 novas propriedades ao interface `MessagingSettings` e ao `defaultSettings`
- Em cada card de recuperação (Boleto, PIX/Cartão, Abandonos), adicionar um botão "Instância" ao lado do Switch
- O botão mostra o nome da instância vinculada (ou "Selecionar") e abre um modal/dialog
- No modal: fetch `GET {server_url}/api/platform/fetch-instances` com Bearer token, listar instâncias disponíveis, permitir selecionar uma
- Ao selecionar, salvar o `instance_name` no state e persistir junto com o save geral

**3. Arquivo: `supabase/functions/send-external-message/index.ts`**
- Ao montar o payload de envio para a API externa, buscar a instância correspondente ao `messageType` da tabela `messaging_api_settings`
- Usar `boleto_instance_name`, `pix_card_instance_name` ou `abandoned_instance_name` conforme o tipo
- Passar `instance` no payload de envio (`POST /api/platform/send-message`)

**4. Arquivo: `supabase/functions/auto-recovery/index.ts`**
- Passar `instanceName` ao chamar `send-external-message`, lendo da settings conforme o tipo de recuperação

### Fluxo do usuário
1. Configura URL + API Key da API externa
2. Vai na seção "Recuperação Automática"
3. Clica no botão "Instância" no card Boleto
4. Modal abre, faz fetch das instâncias da API externa
5. Seleciona a instância desejada
6. Repete para PIX/Cartão e Abandonos
7. Salva — as instâncias ficam persistidas no banco
8. Envios automáticos usam a instância correta por tipo

### Arquivos alterados
- Nova migração SQL (3 colunas)
- `src/components/settings/ExternalApiSettings.tsx` — UI do seletor de instância
- `supabase/functions/send-external-message/index.ts` — usar instância por tipo
- `supabase/functions/auto-recovery/index.ts` — passar instanceName

