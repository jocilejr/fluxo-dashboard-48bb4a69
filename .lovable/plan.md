

## Melhorar prompt da IA: entender a pessoa, não só o progresso

### Problema atual
O prompt foca quase exclusivamente em "onde a pessoa parou" nos materiais. Não analisa o perfil da pessoa como um todo.

### Dados disponíveis para enriquecer

Podemos coletar do banco antes de chamar a IA:

1. **customers**: `name`, `first_seen_at`, `total_transactions`, `total_paid`, `pix_payment_count` — tempo como cliente, quanto já contribuiu, frequência
2. **member_products**: `granted_at` — quando cada produto foi adquirido, ordem de compra
3. **transactions**: histórico de compras da pessoa (valores, datas, tipos de pagamento)
4. **member_content_progress**: `last_accessed_at` — última vez que acessou algo (dias sem acessar?)

### O que muda

**Edge function `member-ai-context/index.ts`:**

1. Receber dados extras do frontend: `totalPaid`, `memberSince`, `daysSinceLastAccess`, `totalProducts`, `paymentMethod`
2. No frontend (`AreaMembrosPublica.tsx`), calcular e enviar esses dados:
   - `memberSince`: data da primeira contribuição (`first_seen_at` do customer ou menor `granted_at`)
   - `totalPaid`: valor total contribuído
   - `daysSinceLastAccess`: dias desde último acesso a qualquer material
   - `totalProducts`: quantos produtos possui
   - `isNewMember`: se tem menos de 7 dias
3. Reescrever o prompt para que a IA **entenda quem é a pessoa**:
   - É membro novo ou antigo?
   - Contribui frequentemente ou fez só uma compra?
   - Está ativa (acessou recentemente) ou sumiu?
   - Tem muitos materiais ou poucos?
   - Adaptar o tom: acolher novata, re-engajar quem sumiu, valorizar fiel

### Novo prompt (essência)

O system prompt vai incluir instruções como:
- "Analise o PERFIL COMPLETO da pessoa antes de escrever"
- "Se é membro nova (< 7 dias), dê boas-vindas calorosas"
- "Se não acessa há mais de 3 dias, mostre saudade e incentive voltar"
- "Se contribuiu bastante (alto valor), reconheça a fidelidade"
- "Se tem muitos produtos, elogie o comprometimento"
- O progresso continua sendo usado, mas como UM dos fatores, não o único

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/AreaMembrosPublica.tsx` | Calcular e enviar `memberSince`, `totalPaid`, `daysSinceLastAccess`, `totalProducts` no payload |
| `supabase/functions/member-ai-context/index.ts` | Receber dados extras, reescrever prompt para análise de perfil completo |

