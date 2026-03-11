

## Corrigir Mobile + Redesign Sutil da Oferta

### Problemas

1. **Produtos não aparecem no iPhone**: O `layout_order` salvo no banco usa as seções antigas (`recent_product`, `other_products`). O novo `products_interleaved` só existe no `defaultLayout` (usado quando não há layout salvo). Resultado: se o admin já salvou um layout, os produtos aparecem pelas seções antigas — que ainda funcionam — mas a sugestão IA entre produtos não aparece. Preciso garantir compatibilidade.

2. **Oferta muito grande**: O `LockedOfferCard` com `inline` ocupa espaço excessivo. O pedido é um card compacto horizontal: imagem chamativa à esquerda + texto IA à direita, sutil e elegante.

### Plano

#### 1. Compatibilidade de layout (fix mobile)

No `AreaMembrosPublica.tsx`, ao processar o `layout_order` do banco:
- Mapear automaticamente `["recent_product", "other_products"]` → `["products_interleaved"]` quando ambos existem
- Isso garante que layouts salvos antigos funcionem com a nova lógica unificada
- Manter os cases `recent_product` e `other_products` como fallback

#### 2. Atualizar LayoutEditor

No `LayoutEditor.tsx`:
- Adicionar `products_interleaved` e `ai_tip` como seções válidas
- Remover `recent_product` e `other_products` do editor (migrar automaticamente)
- Adicionar `ai_tip` com label "Dica da IA"

#### 3. Redesign do LockedOfferCard inline

Transformar o card inline em algo mais sutil e compacto:
- Layout horizontal: imagem (h-16 w-20 rounded-lg) à esquerda, conteúdo à direita
- Sem preço grande, sem botão largo — apenas um link discreto "Conhecer →"
- Mensagem IA como texto principal em destaque (não itálico, direto)
- Badge com cadeado pequeno sobre a imagem
- Altura total máxima ~80px, sem padding excessivo
- Fundo com gradiente muito sutil, borda fina

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/AreaMembrosPublica.tsx` | Migração automática de layout_order antigo → novo |
| `src/components/membros/LayoutEditor.tsx` | Novas seções, migração automática |
| `src/components/membros/LockedOfferCard.tsx` | Redesign inline compacto e sutil |

