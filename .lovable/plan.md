
Plano para corrigir os carregamentos infinitos

1) Corrigir a causa raiz no hook de transações
- Ajustar `src/hooks/useTransactions.ts` para o período padrão (sem filtro explícito) ficar estável no dia atual em horário de Brasília.
- Trocar o `effectiveEnd` dinâmico (`new Date()` a cada render) por um intervalo estável do dia (`startOfDay`/`endOfDay`) memoizado.
- Garantir `queryKey` estável quando não houver filtro manual, evitando criação de nova query a cada render.

2) Manter consistência entre páginas/layout
- Confirmar que os pontos que usam `useTransactions()` sem parâmetros (`AppLayout`, `MobileLayout`, `MobileDashboard`, `MobileTransactions`, `Recuperacao`) passam a compartilhar a mesma query estável.
- Evitar múltiplas consultas duplicadas com chaves diferentes para “hoje”.

3) Endurecer contra re-render excessivo (performance)
- Ajustar `src/hooks/useUnviewedTransactions.ts` e `src/hooks/useUnviewedAbandonedEvents.ts` para não atualizar estado se o valor do localStorage não mudou.
- Manter listener de `storage`, mas impedir `setState` redundante em loop (hoje ele pode disparar re-render recorrente).

4) Validação funcional e de regressão
- Validar `/recuperacao`: sair do “Carregando...” e renderizar dados normalmente.
- Validar `/transacoes`: alternar Hoje/7 dias/30 dias sem loading infinito.
- Validar navegação entre abas sem tempestade de requests no backend.
- Validar mobile (`MobileDashboard` e `MobileTransactions`) com carregamento normal.

Detalhes técnicos (causa confirmada)
- O loop vem de `useTransactions()` sem opções: `effectiveEnd = new Date()` altera `queryKey` continuamente.
- Isso gera refetch contínuo, mantendo `isLoading` e criando a percepção de “carregamento infinito”.
- Evidência: requests repetidos para `transactions` com `created_at=lte` mudando em milissegundos.

Arquivos alvo
- `src/hooks/useTransactions.ts` (correção principal)
- `src/hooks/useUnviewedTransactions.ts` (otimização de re-render)
- `src/hooks/useUnviewedAbandonedEvents.ts` (otimização de re-render)

Resultado esperado
- Recuperação e outras telas deixam de carregar infinitamente.
- Menos requisições repetidas.
- UI mais fluida sem precisar F5 para estabilizar.
