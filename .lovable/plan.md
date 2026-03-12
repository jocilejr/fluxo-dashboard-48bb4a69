

## Situação Atual

A base de conhecimento (`product_knowledge_summaries`) já está populada para 13 dos 16 produtos. Os 3 restantes (443 Letras, Milagre das 7 Manhãs, Terço e Quaresma do Arcanjo Miguel) não possuem materiais cadastrados, então não há conteúdo para extrair.

Nenhuma alteração de código é necessária neste momento. O sistema já está configurado para:
1. A edge function `member-offer-pitch` buscar os resumos da tabela `product_knowledge_summaries` pelos `ownedProductIds`
2. Usar esses resumos para personalizar o Balão 2 com o conhecimento que a pessoa já adquiriu
3. Gerar automaticamente novos resumos quando materiais são adicionados a um produto

Para os 3 produtos sem materiais, basta adicionar os materiais na área de membros e o resumo será gerado automaticamente.

