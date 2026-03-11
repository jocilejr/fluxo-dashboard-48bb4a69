

## Fluxo de Pagamento Interno com PIX, Cartão e Boleto

### Resumo

Adicionar campos configuráveis por oferta (chave PIX e link do cartão) no admin, e criar um fluxo de pagamento interno na área de membros com 3 opções: PIX (mostra chave), Cartão (redireciona para link configurado) e Boleto (formulário com nome e CPF, igual ao GerarBoleto).

### Alterações no banco

**Migração SQL** — adicionar 2 colunas na tabela `member_area_offers`:
- `pix_key` (text, nullable) — chave PIX configurável por oferta
- `card_payment_url` (text, nullable) — link de redirecionamento para pagamento com cartão

### Alterações no admin (`src/pages/AreaMembros.tsx`)

- Adicionar campo "Chave PIX" (input text) no formulário de oferta
- Adicionar campo "Link pagamento cartão" (input text) no formulário
- Salvar/carregar esses campos no `saveMutation` e `openEdit`

### Novo componente `src/components/membros/PaymentFlow.tsx`

Modal com 3 etapas:

**Etapa 1 — Seleção do método:**
- 3 cards visuais: PIX, Cartão de Crédito, Boleto
- Cada card com ícone e descrição curta

**Etapa 2 — Depende da escolha:**
- **PIX**: Exibe a chave PIX (copiável), preço, e mensagem "Ao efetuar o PIX, todo o material será liberado no seu WhatsApp". Insere transação pendente via edge function `member-purchase` com o telefone do membro (já disponível na URL `/membros/:phone`)
- **Cartão**: Redireciona para `card_payment_url` configurada na oferta (abre em nova aba)
- **Boleto**: Formulário inline com Nome Completo e CPF (igual ao GerarBoleto), sem telefone pois já está no sistema. Ao submeter, chama o mesmo webhook do `manual_boleto_settings` passando os dados + telefone do membro automaticamente

### Edge function `supabase/functions/member-purchase/index.ts`

- Recebe `{ phone, offer_name, payment_method, amount }`
- Insere na tabela `transactions` com `type: 'pix'`, `status: 'pendente'`, `customer_phone: phone`, `amount`, `description: offer_name`
- Usa service role (acesso anon na página pública)
- Isso faz aparecer automaticamente na aba de transações via realtime

### Integração nos componentes existentes

- **`PhysicalProductShowcase.tsx`**: Substituir botão "Reservar o seu" por abertura do `PaymentFlow`
- **`LockedOfferCard.tsx`**: Substituir botão "Quero conhecer" por abertura do `PaymentFlow`
- **`AreaMembrosPublica.tsx`**: Passar `normalizedPhone` para os componentes de oferta (já disponível)

### Arquivos

- **Migração SQL**: `pix_key` e `card_payment_url` em `member_area_offers`
- **Novo**: `src/components/membros/PaymentFlow.tsx`
- **Nova edge function**: `supabase/functions/member-purchase/index.ts`
- **Editado**: `src/pages/AreaMembros.tsx` (campos pix_key e card_payment_url)
- **Editado**: `src/components/membros/PhysicalProductShowcase.tsx`
- **Editado**: `src/components/membros/LockedOfferCard.tsx`
- **Editado**: `src/pages/AreaMembrosPublica.tsx` (passar phone)

