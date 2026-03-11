

## Redesign Completo da Área de Membros — Visual Profissional e Legível

### Problema
O design atual é genérico, sem hierarquia visual clara, sem espaçamento adequado e com cards simples demais que não ajudam na leitura. Tanto a página admin (`/area-membros`) quanto a pública (`/membros/:phone`) precisam de upgrade visual.

### Mudanças

**1. Admin — `MemberClientCard.tsx`**
- Card com borda lateral colorida (accent) para destaque visual
- Avatar com iniciais do cliente (círculo colorido)
- Seção de URL com background mais contrastante e ícone de link destacado
- Produtos listados como chips/tags coloridos em vez de bullet points
- Histórico de compras em mini-tabela com cores de status mais vibrantes
- Espaçamento e tipografia melhorados (font sizes, line heights, padding)

**2. Admin — `ContentManagement.tsx`**
- Cards de produto com ícone decorativo, descrição e hover elevado
- Categorias como cards ao invés de badges inline
- Materiais em lista com ícones coloridos por tipo, preview do conteúdo e informações visuais

**3. Admin — `AreaMembros.tsx`**
- Header da página com gradiente sutil e stats resumidos (total membros, produtos liberados)
- Tabs com ícones maiores e estilo pill/segmented

**4. Pública — `AreaMembrosPublica.tsx`**
- Header com padrão decorativo mais elaborado, sombra interna e tipografia premium
- Card de saudação IA com gradiente sutil e borda accent
- Produtos com cards maiores, thumbnails e contagem de materiais visível
- Melhor espaçamento entre seções com títulos decorados

**5. Pública — `ProductContentViewer.tsx`**
- Separadores de categoria com fundo colorido sutil e ícone em destaque
- Grid de materiais com gap maior

**6. Pública — `MaterialCard.tsx`**
- Cards com sombra suave, borda esquerda colorida por tipo
- Descrição visível (quando houver) abaixo do título
- Hover com elevação e scale sutil
- Dialog de conteúdo com header colorido

**7. `DailyVerse.tsx`**
- Visual com fundo gradiente dourado, tipografia serifada para o versículo, decoração com aspas estilizadas

**8. `LockedOfferCard.tsx`**
- Efeito glassmorphism no overlay do cadeado
- Gradiente no botão de compra com animação hover

### Arquivos editados
- `src/components/membros/MemberClientCard.tsx`
- `src/components/membros/ContentManagement.tsx`
- `src/components/membros/MaterialCard.tsx`
- `src/components/membros/ProductContentViewer.tsx`
- `src/components/membros/DailyVerse.tsx`
- `src/components/membros/LockedOfferCard.tsx`
- `src/pages/AreaMembros.tsx`
- `src/pages/AreaMembrosPublica.tsx`

Nenhuma mudança de banco de dados.

