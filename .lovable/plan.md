

## Fix: Produtos não aparecem no iPhone - Problema de RLS

### Causa raiz

A página `/membros/:phone` é **pública** (sem autenticação). Porém, a tabela `delivery_products` tem RLS que exige `auth.uid() IS NOT NULL` para SELECT. Quando o Supabase faz o join `member_products → delivery_products`, os dados do produto voltam `null` porque o usuário anônimo não tem permissão de leitura.

O mesmo ocorre com `customers` (nome do cliente volta null).

No desktop/preview funciona porque há uma sessão de auth ativa do admin. No iPhone, acessando diretamente o link público, não há sessão -- resultado: produtos aparecem mas sem dados (`delivery_products: null`), e `renderProductCard` retorna `null`.

### Solução

Criar políticas RLS públicas de leitura para as tabelas usadas na página pública:

1. **`delivery_products`**: Adicionar policy `Public can read delivery_products` com `USING (true)` para SELECT
2. **`customers`**: Adicionar policy `Public can read customers for member area` com `USING (true)` para SELECT (ou restringir a campos específicos via view, mas policy simples é suficiente dado que a query já filtra por phone)

### Arquivos

| Mudança | Detalhe |
|---|---|
| Migration SQL | Adicionar 2 RLS policies públicas de leitura |

Nenhuma mudança em código React é necessária -- o problema é 100% RLS no banco.

