

## Abrir PDF em popup de tela cheia com visualização simples

Atualmente, ao clicar num material PDF, o sistema abre numa nova aba (`window.open`). A mudança é exibir o PDF dentro de um Dialog quase tela cheia, com um botão grande "Voltar" no topo — interface simplificada para público idoso.

### Mudanças em `src/components/membros/MaterialCard.tsx`

1. **Remover o `window.open` para PDFs** — agora PDFs também abrem o Dialog (`setOpen(true)`)

2. **Dialog de PDF em tela quase cheia**:
   - `DialogContent` com classes `w-[98vw] max-w-[98vw] h-[95vh]` para ocupar quase toda a tela
   - Header fixo com botão grande "← Voltar" (texto grande, padding generoso) + título do material
   - Corpo com `<iframe src={url} />` ocupando 100% do espaço restante para renderizar o PDF nativamente no navegador

3. **Separar o Dialog do PDF** dos outros tipos — usar um Dialog dedicado com estilo fullscreen apenas para PDFs, mantendo o Dialog padrão para texto/vídeo/imagem

### UI para o público de 60+ anos
- Botão "Voltar" com `text-base` ou `text-lg`, ícone `ArrowLeft` grande
- Sem elementos visuais desnecessários — só o PDF e o botão de voltar
- Padding confortável no header

### Arquivo
- `src/components/membros/MaterialCard.tsx`

