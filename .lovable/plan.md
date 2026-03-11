

## Corrigir navegação de páginas e pré-carregar PDF

### Problema 1: Só mostra a primeira página
O `PdfViewer` navega páginas corretamente via estado `currentPage`, mas o bug provavelmente está no cálculo do `canvas.style.width` (linha 60) que pode estar quebrando a renderização em páginas subsequentes. Vou simplificar essa lógica para usar apenas `100%` width no canvas, garantindo que todas as páginas renderizem corretamente.

### Problema 2: Pré-carregar o PDF mais recente em segundo plano
Ao montar o `ProductContentViewer`, identificar o material PDF mais recente (último por `sort_order` ou `created_at`) e iniciar o download do documento em background usando `pdfjsLib.getDocument()`. Armazenar o `PDFDocumentProxy` em um ref/state e passá-lo ao `PdfViewer` quando o usuário abrir o popup, evitando o tempo de carregamento.

### Mudanças

**`src/components/membros/PdfViewer.tsx`**
- Aceitar prop opcional `preloadedPdf: PDFDocumentProxy | null` — se fornecido, pular o fetch e usar direto
- Simplificar o cálculo de `canvas.style.width` para simplesmente `"100%"` com `height: auto`, eliminando o bug de renderização nas páginas seguintes

**`src/components/membros/MaterialCard.tsx`**
- Aceitar prop opcional `preloadedPdf` e passá-la ao `PdfViewer`
- Remover o `lazy()` quando `preloadedPdf` está presente (importar PdfViewer normalmente também)

**`src/components/membros/ProductContentViewer.tsx`**
- Após carregar os materiais, encontrar o PDF mais recente (último na lista ou maior `sort_order`)
- Usar `useEffect` + `useRef` para chamar `pdfjsLib.getDocument(url)` em background
- Passar o `preloadedPdf` como prop ao `MaterialCard` correspondente

### Arquivos
- `src/components/membros/PdfViewer.tsx`
- `src/components/membros/MaterialCard.tsx`
- `src/components/membros/ProductContentViewer.tsx`

