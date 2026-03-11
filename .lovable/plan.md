

## IA Personalizada na Área de Membros + Redesign Visual

### Resumo

Transformar a área de membros de uma página "apagada" em uma experiência envolvente e personalizada por IA, com 3 pontos de inteligência artificial ao longo da página e um design mais compacto e vibrante.

### 1. Nova Edge Function: `member-ai-context`

Substituir a `member-greeting` por uma função mais robusta que gera **3 blocos de conteúdo** em uma única chamada:

- **Saudação personalizada** (topo): Baseada no nome, produtos que possui e materiais disponíveis. Sugere onde recomeçar ("Vi que você tem o material X com Y capítulos — que tal retomar de onde parou?").
- **Dica contextual** (entre produtos): Inserida entre o produto recente e os demais. Uma dica curta e específica sobre o material que a pessoa está praticando, não genérica.
- **Sugestão de oferta** (antes das ofertas bloqueadas): Analisa os produtos que a pessoa já tem e os materiais das ofertas disponíveis, e sugere UMA oferta específica com uma frase tipo "Quem pratica [produto X] costuma se aprofundar com [oferta Y] — pode ser o próximo passo na sua jornada."

O prompt receberá: `firstName`, `products` (com nomes dos materiais dentro de cada produto), e `offers` (nome + descrição de cada oferta disponível). A IA retorna um JSON com `{ greeting, tip, offerSuggestion: { offerId, message } }` via tool calling.

**Arquivo:** `supabase/functions/member-ai-context/index.ts`
**Config:** `verify_jwt = false` no `config.toml`

### 2. Redesign da Página (`AreaMembrosPublica.tsx`)

**Header mais compacto:**
- Reduzir padding de `py-12 sm:py-16` para `py-8 sm:py-10`
- Logo e saudação mais condensados

**Redução de espaçamento geral:**
- `space-y-8` → `space-y-5` no main
- `mb-5` dos headers de seção → `mb-3`
- `py-4` dos cards de produto → `py-3`
- `gap-4` entre cards → `gap-3`

**Cores e ênfase mais fortes:**
- Bordas de `border-gray-100` → `border-gray-200`
- Texto de títulos de seção de `text-gray-900` com fundo colorido mais saturado
- Badges mais visíveis com opacidade maior (`${themeColor}20` em vez de `12`)
- Cards de produto com borda lateral colorida (como já existe no MaterialCard)

**Saudação IA redesenhada:**
- Card com gradiente sutil usando `themeColor`, ícone animado (pulse), texto maior (`text-base` em vez de `text-sm`)

**Novo bloco "Dica da IA" entre produtos:**
- Aparece entre o produto recente e os demais
- Card compacto com ícone de lâmpada, fundo com gradiente suave
- Texto da dica contextual gerada pela IA

**Sugestão de oferta personalizada:**
- Antes da seção de ofertas genéricas, um card destacado com a sugestão da IA
- Mostra a oferta recomendada com a mensagem personalizada
- Botão de ação direto

### 3. Integração no Frontend

- Substituir `loadAiGreeting` por `loadAiContext` que chama `member-ai-context`
- Armazenar os 3 blocos no state: `aiGreeting`, `aiTip`, `aiOfferSuggestion`
- Cache no localStorage com TTL de 4h (em vez de 24h) para manter conteúdo mais fresco
- Adicionar seções `"ai_tip"` e `"ai_offer"` no layout_order

### 4. Atualizar `member-greeting` → `member-ai-context`

A function antiga continua existindo por compatibilidade, mas o frontend passa a usar a nova.

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/member-ai-context/index.ts` | Criar |
| `supabase/config.toml` | Adicionar entry |
| `src/pages/AreaMembrosPublica.tsx` | Redesign + integração IA |
| `src/components/membros/DailyVerse.tsx` | Compactar padding |
| `src/components/membros/LockedOfferCard.tsx` | Highlight para oferta sugerida |

