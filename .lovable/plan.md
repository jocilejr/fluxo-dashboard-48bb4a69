

## Ajustes na Área de Membros Pública

### Mudanças

**1. `src/pages/AreaMembrosPublica.tsx` — Header e Versículo**
- Remover o título "Área de Membros" (`h1`) do header. Manter apenas o logo (se houver) e a frase personalizada com o nome do membro (ex: "Olá, Maria! Bem-vinda à sua área exclusiva!")
- Mover o componente `<DailyVerse />` de antes dos produtos para **entre o 1º e o 2º produto** na lista. O produto mais recente fica em destaque no topo, seguido do versículo, depois os demais produtos.

**2. Lógica de renderização dos produtos**
- Separar `sortedProducts[0]` (mais recente) dos demais
- Renderizar: Produto 1 → DailyVerse → Produtos 2..N
- AI Greeting permanece acima dos produtos

### Arquivos
- `src/pages/AreaMembrosPublica.tsx`

Sem mudanças de banco de dados. A aba de Conteúdo já existe no admin e permite gerenciar categorias e materiais por produto.

