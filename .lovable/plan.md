

## Correção dos 2 erros na Área de Membros

### Erro 1: `Select.Item` com valor vazio (ContentManagement.tsx, linha 224)
- `<SelectItem value="">Sem categoria</SelectItem>` — Radix proíbe `value=""`.
- **Fix**: Trocar para `<SelectItem value="none">Sem categoria</SelectItem>` e tratar `"none"` como nulo ao salvar.

### Erro 2: `sectionMeta[section]` undefined (LayoutEditor.tsx, linha ~83)
- O banco pode conter valores antigos no `layout_order` (ex: `"content"`) que não existem no `sectionMeta`.
- **Fix**: Filtrar o array `order` para incluir apenas seções válidas presentes no `sectionMeta`, e adicionar seções faltantes do `DEFAULT_ORDER`.

### Arquivos
- `src/components/membros/ContentManagement.tsx` (linha 224)
- `src/components/membros/LayoutEditor.tsx` (useEffect, linhas 34-43)

