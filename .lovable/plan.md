

## Refinamento Visual da Área de Membros Admin

### Problemas Identificados
1. Layout colado nas extremidades — sem padding/max-width adequado
2. URL do membro exposta diretamente no card — poluição visual, deve abrir apenas sob demanda (popover)
3. Visual genérico/"de IA" — falta refinamento tipográfico, hierarquia sutil, espaçamento respirável

### Mudanças

**1. `src/pages/AreaMembros.tsx`**
- Adicionar `max-w-5xl mx-auto` no container principal para centralizar e dar respiro
- Aumentar `space-y` e padding geral
- Stats cards: tipografia mais contida (não `font-extrabold`), tamanhos proporcionais
- Header: simplificar — remover gradientes exagerados, usar estilo limpo com apenas texto e ícone discreto

**2. `src/components/membros/MemberClientCard.tsx`**
- Remover a seção de URL visível do card completamente
- Adicionar um botão discreto "Copiar link" que abre um `Popover` com a URL + botão copiar
- Card com padding mais generoso (`p-6`), border-left mais sutil (2px ao invés de 4px)
- Produtos como pills mais discretos, sem fundo colored demais
- Tipografia: `font-semibold` ao invés de `font-bold`, tamanhos mais proporcionais
- Seção "Histórico" com melhor espaçamento

**3. Geral**
- Substituir `font-extrabold` por `font-semibold` em labels
- Usar `text-[10px]` → `text-xs` para legibilidade
- Remover decorações desnecessárias (gradientes circulares no header)

### Arquivos
- `src/pages/AreaMembros.tsx`
- `src/components/membros/MemberClientCard.tsx`

Sem mudanças de banco.

