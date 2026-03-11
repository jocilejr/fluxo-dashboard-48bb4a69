## Plano: Reformular chat, cards e popup da oferta

### Mudanças

**1. `member-ai-context/index.ts` — Reduzir para 2 mensagens**

- Remover `progressMessage` do prompt. Manter apenas `greeting` e `tip` (2 blocos)
- Instruir a IA a variar: ora foca no progresso, ora no perfil, ora num incentivo — mas sempre em 2 mensagens apenas
- Remover menção a valores no prompt

**2. `member-offer-pitch/index.ts` — Reformular persona e formato**

- Mudar o prompt: a IA é uma mulher cristã de 57 anos, líder de comunidade de orações. Não vende, oferece com carinho e pede contribuição caso a pessoa possa contribuir.
- Remover termos de marketing ("insights", "mindset", etc.)
- Retornar **array de mensagens** (2-3 balões curtos) em vez de uma string única, simulando um chat real
- A copy deve ser baseada no `title` + `description` da oferta definida pelo admin
- Adicionar campo `ai_persona_prompt` na tabela `member_area_settings` para o admin definir a personalidade da IA

**3. `AreaMembrosPublica.tsx` — UI**

- Remover o `<h1>Olá, {firstName}</h1>` (o greeting da IA já cumpre esse papel)
- Reduzir os balões do chat de 3 para 2 (greeting + tip)
- Melhorar cards dos produtos: gradient sutil no fundo, tipografia mais forte, ícone do tipo de conteúdo

**4. `LockedOfferCard.tsx` — Reformular card e popup**

- **Card externo**: mais atrativo — gradient de fundo sutil, borda com cor do tema, texto "conheça mais" estilizado
- **Popup (Dialog)**: transformar em mini-chat da Meire Rosana
  - Imagem do produto menor (header compacto, não dominando tudo)
  - Avatar da Meire Rosana + nome no header
  - Mensagens da IA aparecem como balões sequenciais (com delay animado entre eles)
  - Cada mensagem aparece uma após a outra (simulando digitação)
  - Botão CTA no final do chat
  - Sem exibição de preço

**5. Migração: adicionar `ai_persona_prompt` em `member_area_settings**`

- Campo text nullable para o admin definir a personalidade da IA (ex: "mulher de 57 anos, líder de comunidade cristã...")
- O prompt será carregado nas edge functions e usado como base do system prompt

### Arquivos modificados


| Arquivo                                          | Mudança                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `supabase/functions/member-ai-context/index.ts`  | 2 blocos apenas, sem repetição                                      |
| `supabase/functions/member-offer-pitch/index.ts` | Persona cristã, retorna array de mensagens, sem termos de marketing |
| `src/pages/AreaMembrosPublica.tsx`               | Remove header "Olá", renderiza só 2 balões, cards mais bonitos      |
| `src/components/membros/LockedOfferCard.tsx`     | Card atrativo + popup como mini-chat com mensagens sequenciais      |
| Migração SQL                                     | `ai_persona_prompt` em `member_area_settings`                       |
| `src/pages/AreaMembros.tsx`                      | Campo para editar persona da IA nas configurações                   |
