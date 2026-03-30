

## Plano: Separar API de Mensagens e criar página "Auto Rec." na sidebar

### Resumo
1. Mover toda a seção de **Recuperação Automática** (instâncias, limites, horário comercial, botões de execução, stats) do `ExternalApiSettings.tsx` para uma **nova página dedicada** acessível pela sidebar como **"Auto Rec."**
2. Manter no `ExternalApiSettings.tsx` (aba "API Mensagens" em Configurações) apenas: configuração de conexão API, sincronização de dados e logs de mensagens
3. Adicionar item **"Auto Rec."** na sidebar com ícone `Zap` (ou `RefreshCcw`)

### Alterações

**1. Nova página `src/pages/AutoRecuperacao.tsx`**
- Página dedicada com título "Recuperação Automática"
- Contém: cards de instâncias (Boleto, PIX/Cartão, Abandonos) com seleção e status visual, limites diários, delay, horário comercial, stats de hoje, botões de execução manual
- Reutiliza o `InstanceSelectorModal` (extraído ou importado)
- Usa os mesmos hooks de `messaging_api_settings` e `message_log`

**2. Refatorar `src/components/settings/ExternalApiSettings.tsx`**
- Remover toda a seção "Recuperação Automática" (cards de instâncias, limites, horário, stats, botões de execução)
- Manter apenas: Configuração da API Externa (URL, API Key, Webhook, switch ativo, testar conexão, salvar), Sincronização de Dados e Message Logs

**3. Extrair `InstanceSelectorModal` para arquivo próprio**
- `src/components/recovery/InstanceSelectorModal.tsx` — reutilizável pela nova página

**4. Sidebar (`src/components/AppSidebar.tsx`)**
- Adicionar item: `{ title: "Auto Rec.", icon: Zap, path: "/auto-recuperacao", permissionKey: "auto_recuperacao", desktopOnly: true }`
- Posicionar após "Recuperação" na lista

**5. Rotas (`src/App.tsx`)**
- Adicionar lazy import e rota: `<Route path="auto-recuperacao" element={<AutoRecuperacao />} />`

**6. Renomear sidebar "Recuperação" existente**
- Manter como está (Recuperação = BoletoRecoveryDashboard, fila manual)
- A nova "Auto Rec." é exclusivamente para configuração da recuperação automática

### Resultado
- **Configurações > API Mensagens**: conexão API + sync de dados + logs
- **Sidebar > Auto Rec.**: página dedicada com todas as configurações de recuperação automática (instâncias, limites, execução)

