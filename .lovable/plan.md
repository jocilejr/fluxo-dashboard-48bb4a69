

## Plano: Redesign completo da página Auto Rec.

### Problema
Layout confuso, hierarquia visual ruim, muitos elementos competindo por atenção. O phone mockup ocupa espaço demais e a estrutura geral não é profissional.

### Nova estrutura

```text
┌──────────────────────────────────────────────────────────┐
│  ⚡ Recuperação Automática          [Salvar]             │
│  Mensagens exclusivas da automação                       │
│                                                          │
│  ⚠️ Banner API (se não configurada)                      │
├──────────────────────────────────────────────────────────┤
│  Enviadas: 12  │  Falhas: 2  │  Boleto: 4  │  PIX: 3   │
├──────────────────────────────────────────────────────────┤
│  [PIX/Cartão]  [Abandonos]  [Boleto]  [⚙ Config]        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ CONFIGURAÇÃO ─────────────────────────────────────┐  │
│  │                                                     │ │
│  │  [Switch ativo]        Instância: chip    Tempo Real│ │
│  │                                                     │ │
│  │  ┌─ Editor ─────────┐  ┌─ Preview WhatsApp ──────┐ │ │
│  │  │                   │  │  ┌────────────────────┐  │ │ │
│  │  │  [Textarea]       │  │  │ balão verde msg    │  │ │ │
│  │  │                   │  │  │                    │  │ │ │
│  │  │  Variáveis:       │  │  │    14:32 ✓✓        │  │ │ │
│  │  │  {nome} {valor}...│  │  └────────────────────┘  │ │ │
│  │  └───────────────────┘  └──────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘  │
│                                                          │
│  (Boleto: + Régua de cobrança abaixo)                    │
└──────────────────────────────────────────────────────────┘
```

### Mudanças principais

1. **Preview simplificado** — remover o phone mockup pesado (status bar, nav bar, input bar). Substituir por um **balão WhatsApp simples** dentro de um container com fundo escuro estilo chat. Limpo, leve, sem simular um celular inteiro.

2. **Header compacto por aba** — uma única linha com: switch de ativação à esquerda, instância no centro como chip, badge de tipo (Tempo Real / Diário 9h) à direita. Sem card separado para o header.

3. **Layout editor + preview lado a lado** dentro de um único card:
   - Esquerda: textarea + variáveis clicáveis
   - Direita: fundo escuro (#0b141a) com o balão verde da mensagem renderizada + horário + ✓✓
   - Sem moldura de celular, sem status bar, sem input bar

4. **Stats mais discretos** — manter a linha de stats mas com estilo mais sutil (sem bg pesado)

5. **Aba Config** — permanece como está (já funciona bem)

### Detalhes técnicos

- Remover `WhatsAppPhoneMockup` (componente pesado de ~90 linhas)
- Criar `WhatsAppBubblePreview` inline — apenas: container escuro + chip "HOJE" + balão verde com mensagem + timestamp + ✓✓ (~25 linhas)
- Refatorar `RecoveryTabContent` para ter header inline compacto + grid `md:grid-cols-2` com editor e preview no mesmo card
- Manter toda a lógica de estado, mutations, queries inalterada

### Arquivo alterado
- `src/pages/AutoRecuperacao.tsx`

