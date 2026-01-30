
## Problema Identificado: Falta de Correspondência Avançada no Meta Pixel

O evento está disparando corretamente, mas o **Meta Ads não consegue associar o evento ao lead original** porque não estamos enviando os **parâmetros de correspondência avançada (Advanced Matching)**.

### O que é Advanced Matching?

O Meta Pixel permite enviar dados do usuário (telefone, email, etc.) junto com o evento para melhorar a taxa de correspondência entre:
- O clique no anúncio (quando o lead viu o anúncio)
- A conversão (quando o lead acessou a página de entrega)

### Solução

Atualizar o código do Meta Pixel para enviar o **telefone do cliente** formatado corretamente usando o parâmetro `ph` (phone) no `fbq('init')`.

### Alterações Técnicas

#### Arquivo: `src/pages/EntregaPublica.tsx`

1. **Passar o telefone para a função `loadMetaPixel`**
   - Adicionar parâmetro `phone` na função
   - Formatar o telefone para o padrão Meta (apenas números, sem código do país se brasileiro)

2. **Usar Advanced Matching no `fbq('init')`**
   ```javascript
   window.fbq('init', pixelId, {
     ph: phoneFormatted,  // Telefone formatado (apenas números)
     external_id: phoneFormatted  // ID externo para correspondência
   });
   ```

3. **Atualizar o fallback via img tag**
   - Adicionar parâmetro `ud[ph]` na URL do noscript

4. **Atualizar chamada da função**
   - Passar o telefone do cliente para `loadMetaPixel`

### Formato do Telefone para Meta

O Meta espera o telefone:
- Apenas números
- Com código do país (55 para Brasil)
- Sem formatação (parênteses, hífens, espaços)

Exemplo: `5511999999999`

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/EntregaPublica.tsx` | Passar telefone para `loadMetaPixel` e usar Advanced Matching |

### Benefícios Esperados

- **Maior taxa de correspondência**: O Meta poderá associar a conversão ao lead que clicou no anúncio
- **Melhor atribuição**: Campanhas terão dados mais precisos de conversão
- **Otimização de anúncios**: O algoritmo do Meta poderá otimizar melhor as campanhas

### Código Exemplo da Alteração

```javascript
// Antes
window.fbq('init', pixelId);

// Depois
window.fbq('init', pixelId, {
  ph: normalizedPhone,      // Telefone para correspondência
  external_id: normalizedPhone  // ID externo adicional
});
```
