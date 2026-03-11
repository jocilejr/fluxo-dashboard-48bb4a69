

## Plano: Card menor + dimensões de imagem + edição de ofertas

### Mudanças

**1. Card de oferta menor (`LockedOfferCard.tsx`)**
- Reduzir altura da imagem de `h-[120px]` para `h-[90px]`
- Reduzir altura do fallback sem imagem de `h-[100px]` para `h-[80px]`
- Reduzir padding do bottom section

**2. Especificação de dimensões na aba Ofertas (`AreaMembros.tsx` — `MemberOffersTab`)**
- Adicionar texto de ajuda no campo de imagem: "Tamanho recomendado: 600×200px (formato banner horizontal)"

**3. Edição de ofertas (`AreaMembros.tsx` — `MemberOffersTab`)**
- Adicionar estado `editingOffer` para controlar qual oferta está sendo editada
- Criar botão de editar (ícone Edit) ao lado do Switch e do botão de excluir em cada oferta
- Reutilizar o mesmo dialog de criação, mas pré-preenchido com os dados da oferta
- Ao salvar, fazer `update` em vez de `insert` quando `editingOffer` está definido
- Campos editáveis: descrição, imagem, URL de compra, preço, category_tag
- Adicionar campo `category_tag` (texto livre) no form de criar/editar, com placeholder "Ex: Material complementar"

### Arquivos modificados
- `src/components/membros/LockedOfferCard.tsx` — reduzir alturas
- `src/pages/AreaMembros.tsx` — adicionar edição de ofertas + dica de dimensões + campo category_tag

