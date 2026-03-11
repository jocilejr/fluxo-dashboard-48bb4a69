## Área de Membros Completa 

### Visao Geral

Transformar a área de membros atual (que apenas redireciona para links externos) em uma plataforma completa onde o membro navega pelos materiais diretamente na página, com conteúdo organizado em módulos/capítulos, ofertas bloqueadas visíveis, e visual profissional personalizável.

### Banco de Dados

**Nova tabela `member_product_materials**` - Materiais/conteúdos anexados a cada produto:

- `id`, `product_id` (FK delivery_products), `title`, `description`, `content_type` (text, pdf, video, audio, image, link), `content_url` (URL do arquivo ou embed), `content_text` (conteúdo em texto rico para orações/devocinonais), `sort_order`, `is_preview` (se pode ser visto por não-membros como amostra), `created_at`

**Nova tabela `member_product_categories**` - Categorias/módulos dentro de um produto:

- `id`, `product_id`, `name` (ex: "Semana 1", "Orações da Manhã"), `description`, `icon` (emoji ou nome de ícone), `sort_order`, `created_at`
- Adicionar `category_id` na tabela `member_product_materials` para organizar materiais por categoria

**Novo storage bucket `member-files**` - Para upload de PDFs, imagens, áudios dos materiais

**Alterar `member_area_offers**` - Adicionar coluna `category_tag` (ex: "oração", "devoção", "proteção") para segmentar ofertas por preferência

### Página Pública (`AreaMembrosPublica.tsx`) - Redesign Completo

**Header religioso**: Visual com tons dourados/terrosos, ícone de cruz/pomba, saudação personalizada com bênção

**Seção "Seus Produtos"**: Cada produto vira um card expandível que mostra os materiais organizados por categoria/módulo:

- Clicar no produto abre uma visão com as categorias (ex: "Orações da Manhã", "Novenas", "Salmos")
- Cada categoria lista os materiais (PDFs, textos, vídeos)
- Materiais de texto (orações) abrem inline em um modal bonito
- PDFs abrem em nova aba ou viewer embutido
- Vídeos/áudios com player embutido

**Seção "Ofertas Bloqueadas"**: Cards de ofertas que o membro NÃO possui, mostrados com visual de "bloqueado" (blur, cadeado), com preview parcial para gerar interesse + botão de compra

**Seção "Versículo do Dia"**: Toque especial para o nicho - um versículo bíblico aleatório exibido no topo (hardcoded ou de uma lista no banco)

### Admin (`AreaMembros.tsx`) - Nova Aba "Conteúdo"

**Aba "Conteúdo"** (nova):

- Selecionar um produto -> ver/criar categorias -> ver/criar materiais dentro de cada categoria
- Upload de arquivos (PDF, imagem, áudio) para o bucket `member-files`
- Editor de texto simples para conteúdo tipo oração/devoção
- Ordenação drag-like (sort_order manual)

**Aba "Ofertas"** - Adicionar campo de tag/categoria para segmentação

### Arquivos

**Novos:**

- `src/components/membros/ProductContentViewer.tsx` - Viewer de conteúdo do produto (categorias + materiais)
- `src/components/membros/MaterialCard.tsx` - Card individual de material (PDF, texto, vídeo)
- `src/components/membros/LockedOfferCard.tsx` - Card de oferta bloqueada com blur
- `src/components/membros/ContentManagement.tsx` - Admin: gestão de conteúdo por produto
- `src/components/membros/DailyVerse.tsx` - Versículo do dia

**Editados:**

- `src/pages/AreaMembrosPublica.tsx` - Redesign completo com navegação por conteúdo
- `src/pages/AreaMembros.tsx` - Nova aba "Conteúdo"

**Migração SQL:** 2 novas tabelas + storage bucket + alteração em offers

### Fluxo do Membro

```text
Acessa /membros/89981340810
  ↓
Vê saudação + versículo do dia
  ↓
Vê seus produtos como cards
  ↓
Clica em "Santo Antônio" → expande
  ↓
Vê categorias: "Orações", "Novenas", "Material de Apoio"
  ↓
Clica em "Orações" → lista de materiais
  ↓
Clica em "Oração da Manhã" → abre texto inline
  ↓
Rola para baixo → vê ofertas bloqueadas com cadeado
  ↓
"Novena de São José" [🔒 Bloqueado] → botão "Adquirir"
```