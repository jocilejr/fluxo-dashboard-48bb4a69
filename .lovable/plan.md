ADICIONAR: Sessão onde consigo editar o design da página de membros,  
  
Devo poder selecionar o posicionamento de cada elemento [Mensagem personalizada I.A], [Conteúdo],  [Salmo], [card de oferta]  
  
  
Atualizar Tipos de Material e Adicionar Botão com URL

### Mudanças

**1. Migração de banco** — adicionar coluna `button_label` em `member_product_materials`

- Para o tipo "texto", `content_url` já pode armazenar a URL do botão. Falta apenas o label do botão.

**2. `src/components/membros/ContentManagement.tsx**`

- Tipos disponíveis: **PDF**, **Vídeo**, **Imagem**, **Texto** (remover "Áudio" e "Link externo")
- Para tipo "Texto": mostrar campo `Textarea` + campo opcional "URL do botão" + campo opcional "Texto do botão"
- Para PDF/Vídeo/Imagem: campo de URL como já existe
- Novo state `matButtonLabel` para o label do botão

**3. `src/components/membros/MaterialCard.tsx**`

- Para tipo "text": renderizar o texto + se `content_url` existir, mostrar um botão estilizado com o `button_label` (ou "Acessar" como fallback) que abre a URL
- Remover referências a "audio" e "link" dos type configs
- Corrigir cores hardcoded (`text-gray-900`, `bg-white`) para tema escuro

### Arquivos

- Migração SQL (1 coluna)
- `src/components/membros/ContentManagement.tsx`
- `src/components/membros/MaterialCard.tsx`