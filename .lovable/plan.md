

## Melhorar Aba Membros: Agrupamento por Cliente + URL + Histórico

### Problema
Atualmente, cada `member_product` aparece como um card separado. O admin não vê o nome do cliente, a URL para enviar, nem o histórico de compras. Quando libera 2 produtos para o mesmo telefone, aparecem 2 cards desconectados.

### Solução

Reformular o `MemberProductsTab` em `src/pages/AreaMembros.tsx`:

**1. Agrupar por telefone** — Usar os `memberProducts` já carregados e agrupá-los por `normalized_phone`. Cada grupo vira um card de cliente.

**2. Buscar nome do cliente** — Adicionar uma query a `customers` para trazer o nome associado a cada telefone.

**3. Exibir URL copiável** — Cada card mostra a URL completa (`seusite.com/membros/TELEFONE`) com botão de copiar em destaque.

**4. Histórico de compras expandível** — Usar `Collapsible` para mostrar transações do cliente (lazy-loaded ao expandir), com valor, status, data e produto.

### Layout do card

```text
┌──────────────────────────────────────────────────┐
│ 👤 Maria da Silva                                │
│ 📱 89981340810  [Ativo]                          │
│                                                  │
│ 🔗 https://site.com/membros/89981340810   [📋]   │
│                                                  │
│ Produtos liberados:                              │
│  • Santo Antônio   [🗑]                          │
│  • Oração da Manhã [🗑]                          │
│                                                  │
│ [+ Liberar outro produto]                        │
│                                                  │
│ ▼ Histórico de Compras (clique para expandir)    │
│  ┌────────────────────────────────────────────┐  │
│  │ Santo Antônio | R$ 62,00 | Pago | 11/03   │  │
│  │ Oração       | R$ 30,00 | Gerado | 10/03  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Alterações em `src/pages/AreaMembros.tsx`

- **Agrupar** `memberProducts` por `normalized_phone` (client-side, usando Map)
- **Nova query** para buscar `customers` (nome) — já temos RLS que permite leitura autenticada
- **Nova query** lazy para `transactions` ao expandir um cliente (usando `generatePhoneVariations`)
- **Botão "Liberar outro produto"** dentro do card do cliente, que pre-preenche o telefone no dialog
- **URL em destaque** com texto clicável + botão copiar
- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` e `ChevronDown`

Nenhuma mudança de banco de dados necessária.

