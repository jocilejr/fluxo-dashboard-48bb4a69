

## Plano: Redesign com preview de mensagem WhatsApp

### Problema
O layout atual empilha textarea + variáveis + instância de forma confusa. Falta contexto visual de como a mensagem vai ficar para o cliente.

### Solução
Redesign de cada aba de recuperação com layout **lado a lado**: editor à esquerda, preview WhatsApp à direita.

### Estrutura de cada aba (PIX/Cartão, Abandonos, Boleto)

```text
┌─────────────────────────────────────────────────────┐
│ [Switch] PIX / Cartão          [Badge: Tempo Real]  │
│ Descrição curta                                     │
├────────────────────────┬────────────────────────────┤
│  CONFIGURAÇÃO          │  PREVIEW                   │
│                        │                            │
│  Instância WhatsApp    │  ┌──────────────────────┐  │
│  [card instância]      │  │ ☎ WhatsApp balloon   │  │
│                        │  │                      │  │
│  Mensagem              │  │ Olá João! Notamos    │  │
│  [textarea]            │  │ que seu pagamento de │  │
│                        │  │ R$ 97,00 está...     │  │
│  Variáveis: {nome}...  │  │                      │  │
│                        │  │         14:32 ✓✓     │  │
│  [Executar agora]      │  └──────────────────────┘  │
└────────────────────────┴────────────────────────────┘
```

### Detalhes

1. **Componente `WhatsAppPreview`** — renderiza a mensagem como um balão de WhatsApp:
   - Fundo verde claro (estilo WhatsApp)
   - Substitui as variáveis por dados de exemplo: `{primeiro_nome}` → "João", `{valor}` → "R$ 97,00", `{produto}` → "Curso Digital", `{saudação}` → saudação baseada na hora
   - Mostra horário atual e double-check (✓✓)
   - Header com nome do contato e avatar placeholder
   - Atualiza em tempo real conforme o usuário digita

2. **Layout lado a lado** em `grid md:grid-cols-2`:
   - Coluna esquerda: instância + textarea + variáveis + botão executar
   - Coluna direita: preview WhatsApp sticky

3. **Para Boleto**: o preview mostra a mensagem da primeira regra da régua, e a `BoletoRecoveryRulesConfig` fica abaixo do grid

4. **Configurações gerais** permanecem como card separado abaixo

### Arquivo alterado
- `src/pages/AutoRecuperacao.tsx` — rewrite do JSX das abas + componente `WhatsAppPreview` inline

