

## Exportar Clientes em CSV

Adicionar um botão de exportação CSV na página de Clientes (`/clientes`), seguindo o mesmo padrão já usado em `DataImportExport.tsx`.

### Alteração

**Arquivo:** `src/pages/Clientes.tsx`

1. Adicionar botão "Exportar CSV" no header da página (ao lado do campo de busca)
2. Implementar função `handleExportCustomers` que:
   - Busca todos os registros da tabela `customers`
   - Formata os campos relevantes: nome, telefone, email, documento, total de transações, total pago, total pendente, total abandonos, primeira e última vez visto
   - Gera o CSV com BOM UTF-8 e faz download automático (`clientes_YYYY-MM-DD.csv`)
3. Adicionar estado `isExporting` para feedback visual (spinner no botão)

Os dados exportados incluirão: nome, telefone (display), email, documento, total_transactions, total_paid, total_pending, total_abandoned_events, pix_payment_count, first_seen_at, last_seen_at.

