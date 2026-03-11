

## Redesign Premium da Área de Membros -- Inspirado em Apps de Referência

### Problemas Atuais

1. **Visual genérico**: cores slate/branco sem personalidade, cards todos iguais, sem hierarquia visual
2. **IA lenta e feia**: skeleton de loading genérico, balões de IA sem identidade, copy da oferta não usa título/descrição da oferta
3. **Baixa conversão**: cards de oferta bloqueados são idênticos aos produtos (mesma cor, mesma estrutura), não geram desejo
4. **Header sem vida**: apenas texto "Olá, nome" sem impacto visual

### Direção de Design -- Inspiração Netflix/Spotify/Apple

Em vez do layout slate genérico, vou criar um design com **fundo escuro premium** (dark mode elegante) com acentos de cor vibrantes. Referências:
- **Netflix**: hero card grande para o produto principal, cards com imagens ricas
- **Spotify**: tipografia bold, gradientes sutis, cards com cantos arredondados e profundidade
- **Apple**: espaçamento generoso, glassmorphism, micro-animações

### Mudanças Detalhadas

#### 1. `AreaMembrosPublica.tsx` -- Redesign Completo

**Fundo e atmosfera:**
- Background: gradiente escuro sutil (`from-slate-950 via-slate-900 to-slate-950`) em vez de `bg-slate-50`
- Textos claros sobre fundo escuro (white/slate-200/slate-400)

**Header Premium:**
- Fundo com glassmorphism escuro (`bg-white/5 backdrop-blur-xl`)
- Logo maior com glow sutil usando themeColor
- Nome em texto grande bold, subtítulo em slate-400
- Barra de themeColor no topo com gradiente (não cor sólida)

**Hero Product (primeiro produto):**
- Card diferenciado do resto: maior, com imagem/logo grande, gradiente de fundo usando themeColor
- Badge "✓ Desbloqueado" com ícone animado
- Expandido por padrão com transição suave

**Product Cards (demais):**
- Fundo `bg-white/5` com border `border-white/10`
- Logo do produto com ring colorido sutil
- Badge verde "Liberado" com estilo premium
- Hover com brilho sutil

**AI Greeting -- Sem balão genérico:**
- Remover completamente o card/balão da IA
- Integrar a saudação diretamente no header como subtítulo dinâmico
- Se a IA ainda não carregou, mostrar a welcome_message do settings como fallback
- Zero loading skeleton visível para o greeting

**AI Tip -- Inline, sem card:**
- Texto direto entre seções, sem borda, sem fundo, sem ícone
- Apenas texto em itálico com cor suave, como uma nota pessoal
- Aparece instantaneamente quando disponível, sem skeleton

**Loading da IA:**
- Remover completamente os skeletons de IA
- A página carrega normalmente sem IA, e quando os textos chegam eles aparecem com fade-in sutil
- Sem "Preparando sugestões personalizadas..." -- zero indicação de loading de IA

#### 2. `LockedOfferCard.tsx` -- Card de Conversão Premium

**Visual que gera desejo (não idêntico ao produto):**
- Card com imagem de fundo grande (se tiver `image_url`), com overlay gradiente escuro
- Texto do nome da oferta em branco bold sobre a imagem
- Badge "Exclusivo" ou category_tag com cor vibrante
- Efeito de "brilho" no border com themeColor
- Visual inspirado em cards de Netflix (imagem dominant, texto minimal)

**Popup redesenhado:**
- Fundo escuro (`bg-slate-900`) para manter consistência
- Imagem grande no topo
- Mensagem da IA como texto principal
- Botão CTA grande e vibrante com themeColor
- Badge dos produtos que a pessoa já tem

#### 3. `member-ai-context/index.ts` -- Prompt Melhorado

**Problema atual:** A copy da oferta é genérica porque o prompt não enfatiza usar o título e descrição da oferta.

**Correções no prompt:**
- Adicionar no offerList o campo `description` com destaque para o modelo usá-lo
- Regra explícita: "A mensagem da oferta DEVE citar o NOME EXATO da oferta e sua DESCRIÇÃO. NUNCA use termos genéricos como 'este material' ou 'este conteúdo'. Fale sobre o que a oferta oferece com base na descrição fornecida."
- Adicionar cada oferta com mais contexto: `[ID: xxx] "Nome da Oferta" — Descrição: "descrição completa aqui"`
- Instruir a IA a criar copy de vendas persuasiva, não informativa

#### 4. `DailyVerse.tsx` -- Estilo Dark Mode

- Adaptar para fundo escuro: texto em slate-300, referência em slate-500
- Fundo `bg-white/5` com border `border-white/10`

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/AreaMembrosPublica.tsx` | Redesign completo: dark mode premium, hero product, AI inline sem loading |
| `src/components/membros/LockedOfferCard.tsx` | Card estilo Netflix com imagem dominante + popup dark |
| `supabase/functions/member-ai-context/index.ts` | Prompt com ênfase em usar título/descrição da oferta, copy persuasiva |
| `src/components/membros/DailyVerse.tsx` | Adaptar visual para dark mode |

### Resultado Esperado

Uma página que parece um app premium (Netflix/Spotify), não um formulário web. Fundo escuro, cards com profundidade, imagens dominantes nos cards de oferta, zero loading visível de IA, copy personalizada que cita nome e descrição real da oferta.

