

## Redesign Completo da Área de Membros Pública

### Visão geral

Redesign profundo focado em três pilares: (1) header com personalidade, (2) produtos com identidade visual premium, (3) ofertas bloqueadas idênticas aos produtos com popup IA, (4) dica como conversa pessoal.

### 1. Header — Compacto e com identidade

Remover o header gradient genérico. Substituir por um header compacto com logo à esquerda + saudação personalizada pela IA à direita. Sem gradientes vibrantes, sem pattern dots. Fundo branco/slate limpo com uma faixa sutil do themeColor no topo (4px).

```text
┌──────────────────────────────────┐
│ ████ themeColor bar (4px)        │
│                                  │
│  [Logo]  Olá, Junior! 👋        │
│          Sua área exclusiva      │
└──────────────────────────────────┘
```

### 2. Cards de produto — Premium e com identidade

Cada produto terá um card mais rico:
- Logo do produto maior (h-14 w-14) com sombra
- Nome do produto em destaque
- Badge "✓ Liberado" em verde com estilo pill
- Fundo com gradiente sutil usando a cor do tema
- Bordas arredondadas maiores (rounded-2xl)
- Ao expandir, conteúdo aparece com transição suave

### 3. Ofertas bloqueadas — Idênticas aos produtos + Popup

O card da oferta será **visualmente idêntico** ao card de produto, mas com:
- Overlay semi-transparente com ícone de cadeado
- Badge "🔒 Contribua para liberar" no lugar do "✓ Liberado"
- Imagem/logo com filtro grayscale + blur sutil
- **Ao clicar**: abre um Dialog/popup com mensagem personalizada pela IA

O popup conterá:
- Nome do produto bloqueado
- Mensagem IA: "Este é um material especial, mas você ainda não contribuiu para recebê-lo. Até agora, você contribuiu com [Produto A] e [Produto B], que são incríveis! Para desbloquear [Produto X], contribua pelo link abaixo."
- Botão "Contribuir" linkando ao purchase_url

### 4. Dica IA — Conversa pessoal, não "dica"

Remover o visual de "card de dica" (ícone Lightbulb, label "Dica para você", fundo amarelo).
Substituir por um card simples com avatar/ícone discreto e texto conversacional direto, sem header/label. Apenas o texto da IA como se fosse uma mensagem pessoal. Fundo branco com borda sutil.

### 5. Edge Function — Atualizar prompt

Atualizar o prompt do `member-ai-context` para:
- Na `offerSuggestion.message`: incluir os nomes dos produtos que a pessoa já contribuiu e explicar que ela ainda não contribuiu para o produto sugerido
- Na `tip`: gerar em tom conversacional direto (sem parecer dica genérica), mencionando nome e materiais específicos

Adicionar ao payload da function: lista de nomes dos produtos que a pessoa já possui (para a IA referenciar no popup da oferta).

### 6. Seção "offers" — Grid de cards bloqueados

As ofertas na seção "Conteúdos Exclusivos" usarão o mesmo estilo de card bloqueado (idêntico ao produto, com overlay + cadeado), sem o layout horizontal antigo.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/AreaMembrosPublica.tsx` | Redesign header, product cards, tip section, offer cards com popup |
| `src/components/membros/LockedOfferCard.tsx` | Reescrever para visual idêntico ao produto + popup Dialog |
| `supabase/functions/member-ai-context/index.ts` | Atualizar prompt para incluir nomes dos produtos adquiridos na mensagem da oferta |

