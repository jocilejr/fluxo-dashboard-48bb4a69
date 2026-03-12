

## Rastreamento em Tempo Real de Membros

### Objetivo
Adicionar à área de membros (admin) visibilidade completa sobre: quantos acessos cada membro teve, se está online agora, o que está fazendo na página, e quando saiu.

### 1. Nova tabela: `member_sessions`

```sql
CREATE TABLE public.member_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  current_activity text DEFAULT 'viewing_home',
  current_product_name text,
  current_material_name text,
  page_url text,
  user_agent text
);

CREATE INDEX idx_member_sessions_phone ON member_sessions(normalized_phone);
CREATE INDEX idx_member_sessions_heartbeat ON member_sessions(last_heartbeat_at);

-- RLS: public pages (anon) can insert/update, authenticated can read
ALTER TABLE member_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert sessions" ON member_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon can update own sessions" ON member_sessions FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can read sessions" ON member_sessions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.member_sessions;
```

Também adicionar coluna `total_accesses` na tabela `member_products` (ou usar contagem da nova tabela).

### 2. Tracking no lado público (`AreaMembrosPublica.tsx`)

Ao carregar a página:
- **Criar sessão**: INSERT em `member_sessions` com `current_activity: 'viewing_home'`
- **Heartbeat**: A cada 30s, UPDATE `last_heartbeat_at` e `current_activity`
- **Tracking de atividade**: Quando o membro abre um produto/material, atualizar `current_activity` para `'viewing_product'` ou `'reading_pdf'` ou `'watching_video'`, com nomes do produto/material
- **Saída**: No `beforeunload` e no cleanup do useEffect, marcar `ended_at = now()`

Atividades rastreadas:
- `viewing_home` — Na página inicial da área
- `viewing_product` — Visualizando conteúdo de um produto
- `reading_pdf` — Lendo um PDF específico
- `watching_video` — Assistindo um vídeo
- `viewing_offer` — Visualizando uma oferta

### 3. Nova aba "Atividade" no admin (`AreaMembros.tsx`)

Nova tab com ícone `Activity` mostrando:

**Painel superior — Membros Online Agora**
- Cartões com contagem de online (heartbeat < 60s), total de sessões hoje, tempo médio de sessão
- Lista em tempo real (Realtime subscription) dos membros ativos com:
  - Nome/telefone
  - Indicador verde pulsante "Online"
  - O que está fazendo: "Lendo PDF — Apostila de Oração pág. 12"
  - Tempo na sessão atual

**Painel inferior — Histórico de Acessos**
- Tabela com todos os acessos recentes:
  - Telefone/nome, data/hora entrada, data/hora saída, duração, atividades realizadas
  - Badge "Online" ou horário de saída
  - Contagem total de acessos por membro

**Notificações de saída**: Quando `ended_at` é preenchido via Realtime, exibir toast "Fulano saiu da área de membros" (opcional, configurável).

### 4. Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `member_sessions` |
| `src/pages/AreaMembrosPublica.tsx` | Adicionar hooks de sessão, heartbeat, tracking de atividade |
| `src/components/membros/ProductContentViewer.tsx` | Emitir evento de atividade ao abrir material |
| `src/components/membros/MemberActivityTab.tsx` | **Novo** — Painel admin com online/histórico |
| `src/pages/AreaMembros.tsx` | Adicionar aba "Atividade" |

### 5. Fluxo técnico

```text
Membro abre /membros/:phone
  → INSERT member_sessions (started_at, activity: viewing_home)
  → setInterval 30s: UPDATE last_heartbeat_at + current_activity
  → Abre produto: UPDATE current_activity = 'viewing_product', current_product_name
  → Abre PDF: UPDATE current_activity = 'reading_pdf', current_material_name
  → Fecha aba/sai: UPDATE ended_at = now()

Admin em /area-membros → aba Atividade
  → SELECT sessions WHERE last_heartbeat_at > now() - 60s (online)
  → Realtime subscription para atualizações ao vivo
  → Toast quando ended_at é preenchido
```

### Critério "online"
Membro com `last_heartbeat_at` nos últimos 60 segundos e `ended_at IS NULL` = online.

