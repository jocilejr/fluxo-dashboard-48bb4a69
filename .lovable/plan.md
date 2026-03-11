

## Plano: Ofertas dinâmicas com múltiplos formatos + barra flutuante

### Problema
Existe apenas 1 formato de oferta (card com cadeado). Tudo parece igual e previsível, criando sensação de "loja" em vez de área de estudo.

### Solução
Criar **2 tipos de oferta** com posicionamentos diferentes, e intercalar cards a cada 2 produtos. A experiência deve ser sutil e conectada ao conteúdo que a pessoa já consome.

---

### 1. Intercalação a cada 2 produtos (`AreaMembrosPublica.tsx`)
- Nova lógica: a cada 2 cards de produto, inserir 1 oferta (ciclando pelas ofertas disponíveis)
- A primeira oferta usa o formato **card redesenhado**
- A segunda oferta (se existir) vai para a **barra flutuante** no rodapé

### 2. Card de oferta redesenhado (`LockedOfferCard.tsx`)
Transformar o card atual (horizontal minimalista) em algo mais chamativo mas orgânico:
- Se tem imagem: mostrar como banner de largura total (~120px altura) com overlay gradiente suave
- Badge com `category_tag` da oferta (ou "Recomendado para você") usando themeColor
- Descrição curta (1 linha) abaixo do título
- Borda com gradiente sutil pulsante (animação leve no hover)
- Botão discreto "Conhecer" integrado ao card
- Manter o dialog de chat ao clicar

### 3. Nova barra flutuante (`FloatingOfferBar.tsx`)
Componente novo, fixo no bottom da tela:
- Aparece após scroll de 300px (com animação slide-up)
- Mostra a **segunda oferta** (ou uma oferta diferente da que está nos cards)
- Layout: ícone/mini-imagem + texto curto contextual + botão "Ver mais"
- Texto conectado ao progresso: ex. "Complementa o que você está estudando" ou usa o `category_tag`
- Pode ser fechada (dismiss) com X, reaparece na próxima visita
- Fundo branco com sombra, bordas arredondadas, altura ~56px
- Não aparece se só existe 1 oferta (nesse caso, card apenas)

### 4. Sutileza na conexão com materiais
- No card de oferta, se a oferta tem `product_id` vinculado a um `delivery_product`, verificar se o membro tem materiais do mesmo tema
- Mostrar texto contextual como "Aprofunde seus estudos" em vez de "Compre agora"
- Nunca mostrar preço no card externo
- A barra flutuante usa linguagem de continuidade: "Continue sua jornada", "Material complementar"

### Arquivos
- `src/pages/AreaMembrosPublica.tsx` — nova intercalação 2:1 + renderizar FloatingOfferBar
- `src/components/membros/LockedOfferCard.tsx` — redesign visual do card
- `src/components/membros/FloatingOfferBar.tsx` — novo componente de barra flutuante

