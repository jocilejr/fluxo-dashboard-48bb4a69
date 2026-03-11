

## Plano: Card de oferta no estilo da imagem + intercalar com produtos + AI mencionar materiais que a pessoa já tem

### 1. Redesenhar `LockedOfferCard.tsx` — estilo da imagem

O card externo deve ser simples e limpo como na imagem:
- Fundo branco, bordas arredondadas, sombra sutil
- Imagem do produto à esquerda (rounded, tamanho similar aos cards de produtos)
- Nome do produto em negrito
- Lock icon pequeno + "Toque para saber mais" em cor do tema
- Remover `category_tag`, `Heart` icon, gradient de fundo — manter minimalista
- O card deve ter a mesma aparência visual dos cards de produtos adquiridos (mesma altura, padding, estilo)

### 2. Intercalar ofertas com produtos em `AreaMembrosPublica.tsx`

Atualmente: produtos primeiro, depois "Descubra mais" com ofertas separadas.

Novo layout:
- Remover a seção "Descubra mais" separada
- Criar uma lista unificada que intercala produtos e ofertas
- Lógica: primeiro produto, depois primeira oferta, demais produtos, demais ofertas
- O DailyVerse continua no final

### 3. Atualizar prompt do `member-offer-pitch` — mencionar materiais da pessoa

Adicionar ao prompt:
- "Informe que ela ainda não contribuiu para receber este material"
- "Mencione que os materiais dela são: {lista de produtos que possui}"
- Isso contextualiza a conversa e mostra que a IA conhece a pessoa

### 4. Atualizar preview estático em `AreaMembros.tsx`

Intercalar cards de ofertas com produtos no preview estático, usando o mesmo estilo visual.

### 5. Corrigir build error

Verificar e corrigir o erro de build (provavelmente tipos `as any` ou import faltando).

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/membros/LockedOfferCard.tsx` | Redesenhar card externo no estilo da imagem (minimalista, lock + "Toque para saber mais") |
| `src/pages/AreaMembrosPublica.tsx` | Intercalar ofertas com produtos em lista unificada |
| `supabase/functions/member-offer-pitch/index.ts` | Adicionar instrução para mencionar materiais que a pessoa já tem e que não contribuiu para este |
| `src/pages/AreaMembros.tsx` | Sincronizar preview com layout intercalado |

