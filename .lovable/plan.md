

## Plano de Reformulacao do Sistema

Este plano cobre duas grandes frentes: otimizacao de desempenho e criacao de um navegador web integrado com persistencia de sessao.

---

### Fase 1: Otimizacao de Desempenho

#### 1.1 - Lazy Loading de Paginas (Code Splitting)

Todas as 14 paginas em `src/pages/` serao carregadas sob demanda usando `React.lazy()` e `Suspense`. Hoje, TODAS as paginas sao importadas no `App.tsx` de forma sincrona, o que faz o bundle inicial carregar tudo de uma vez.

**Arquivo:** `src/App.tsx`
- Substituir imports estaticos por `React.lazy()`
- Envolver as rotas em `Suspense` com fallback de loading
- Isso reduz o tamanho do bundle inicial em ~60-70%

#### 1.2 - Cache de Transacoes com staleTime

**Arquivo:** `src/hooks/useTransactions.ts`
- Adicionar `staleTime: 30000` (30s) para evitar re-fetch a cada navegacao entre paginas
- Adicionar `gcTime: 300000` (5min) para manter dados em memoria
- Os dados continuam sendo atualizados via Realtime, entao nao perde atualizacoes

#### 1.3 - Otimizacao do QueryClient Global

**Arquivo:** `src/App.tsx`
- Configurar `defaultOptions` no QueryClient com `staleTime` e `gcTime` globais
- Evitar re-fetches desnecessarios ao navegar entre abas

#### 1.4 - Memoizacao de Componentes Pesados

**Arquivos:** `src/components/AppLayout.tsx`, `src/components/AppSidebar.tsx`
- Usar `React.memo` nos componentes de layout para evitar re-renders ao navegar
- O `AppLayout` hoje re-renderiza inteiro a cada mudanca de rota

#### 1.5 - Otimizacao de Imports do Lucide

**Todos os arquivos que usam lucide-react**
- Garantir que os imports sao individuais (ja parecem ser, mas validar)
- Isso evita carregar todos os 1000+ icones

---

### Fase 2: Navegador Web Integrado (Web Browser)

#### 2.1 - Nova Tabela no Banco de Dados

Criar tabela `browser_sessions` para persistir sessoes:

```text
browser_sessions
  - id (uuid, PK)
  - user_id (uuid, NOT NULL)
  - url (text, NOT NULL)
  - title (text)
  - favicon (text)
  - last_accessed_at (timestamptz)
  - is_pinned (boolean, default false)
  - sort_order (integer, default 0)
  - created_at (timestamptz)
  - updated_at (timestamptz)
```

Com RLS: usuarios so veem suas proprias sessoes.

#### 2.2 - Nova Edge Function: `browser-proxy`

**Arquivo:** `supabase/functions/browser-proxy/index.ts`

Funcao que atua como proxy para carregar paginas web externas, contornando restricoes de CORS e X-Frame-Options que impedem iframes de carregar sites diretamente.

Funcionamento:
1. Recebe uma URL via POST
2. Faz fetch da pagina no servidor
3. Reescreve URLs relativas para absolutas
4. Remove headers que bloqueiam iframe (X-Frame-Options, CSP)
5. Retorna o HTML processado

#### 2.3 - Nova Pagina: Navegador

**Arquivo:** `src/pages/Navegador.tsx`

Interface com:
- Barra de endereco (input de URL) no topo
- Botoes de navegacao (voltar, avancar, recarregar)
- Area principal com iframe que carrega o conteudo via proxy
- Sidebar lateral com lista de sessoes/abas salvas
- Botao para salvar/fixar a pagina atual
- Ao abrir o navegador, carrega automaticamente a ultima sessao do usuario

#### 2.4 - Componentes do Navegador

**Arquivos novos:**
- `src/components/browser/BrowserToolbar.tsx` - Barra de endereco + botoes
- `src/components/browser/BrowserSidebar.tsx` - Lista de sessoes salvas
- `src/components/browser/BrowserFrame.tsx` - Container do iframe com proxy

#### 2.5 - Hook para Sessoes

**Arquivo:** `src/hooks/useBrowserSessions.ts`

Hook que gerencia:
- CRUD de sessoes no banco
- Sincronizacao entre dispositivos (qualquer dispositivo ve as mesmas sessoes)
- Auto-save da URL atual a cada navegacao
- Ordenacao e fixacao de sessoes favoritas

#### 2.6 - Integracao na Sidebar

**Arquivo:** `src/components/AppSidebar.tsx`

Adicionar novo item de navegacao:
- Icone: `Globe` (lucide-react)
- Titulo: "Navegador"
- Path: `/navegador`
- Permissao: `navegador`

#### 2.7 - Rota no App

**Arquivo:** `src/App.tsx`

Adicionar rota `/navegador` com `ProtectedRoute` e `ResponsiveLayout`.

---

### Fase 3: Persistencia de Sessao Cross-Device

A arquitetura garante que ao abrir o navegador em qualquer dispositivo:
1. Busca as sessoes salvas do usuario no banco
2. Abre automaticamente a ultima pagina acessada
3. Mostra todas as sessoes salvas na sidebar lateral
4. Ao navegar para uma nova URL, atualiza automaticamente no banco
5. Sessoes fixadas aparecem sempre no topo

---

### Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| Modificar | `src/App.tsx` (lazy loading + nova rota) |
| Modificar | `src/hooks/useTransactions.ts` (cache) |
| Modificar | `src/components/AppSidebar.tsx` (novo item) |
| Modificar | `src/components/AppLayout.tsx` (memo) |
| Criar | `src/pages/Navegador.tsx` |
| Criar | `src/components/browser/BrowserToolbar.tsx` |
| Criar | `src/components/browser/BrowserSidebar.tsx` |
| Criar | `src/components/browser/BrowserFrame.tsx` |
| Criar | `src/hooks/useBrowserSessions.ts` |
| Criar | `supabase/functions/browser-proxy/index.ts` |
| Criar | Migracao: tabela `browser_sessions` |

### Limitacoes Conhecidas

- Alguns sites (bancos, Google, etc.) bloqueiam acesso mesmo via proxy por usar deteccao avancada de bots
- Sites que dependem muito de JavaScript interativo podem nao funcionar 100% via proxy
- Login em sites externos nao sera mantido (cookies ficam no servidor, nao no navegador do usuario)

