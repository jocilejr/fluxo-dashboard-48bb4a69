

## Redesign da Área de Membros + Sistema de Progresso

### Problemas Identificados

1. **Popups bugados**: `MaterialCard` usa classes como `bg-card`, `border-border`, `text-foreground`, `bg-muted/50` que resolvem para cores escuras no tema padrão do shadcn. Precisa forçar cores claras explícitas.
2. **Layout genérico**: Cards de produto são simples demais, sem personalidade. Falta contexto de progresso.
3. **Sem rastreamento de progresso**: Não existe tabela para guardar onde o usuário parou (página do PDF, % do vídeo).
4. **IA sem contexto de progresso**: O prompt não recebe dados de progresso para personalizar sugestões.

### Plano de Implementação

#### 1. Nova tabela `member_content_progress` (Migration)

```sql
CREATE TABLE public.member_content_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  material_id uuid NOT NULL REFERENCES member_product_materials(id) ON DELETE CASCADE,
  progress_type text NOT NULL DEFAULT 'pdf', -- pdf, video
  current_page integer DEFAULT 0,
  total_pages integer DEFAULT 0,
  video_seconds integer DEFAULT 0,
  video_duration integer DEFAULT 0,
  last_accessed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(normalized_phone, material_id)
);

ALTER TABLE member_content_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read/write progress" ON member_content_progress
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
```

Isso permite rastrear: página atual do PDF, total de páginas, segundos assistidos do vídeo.

#### 2. Corrigir `MaterialCard.tsx` — Cores explícitas claras

Substituir todas as classes de tema genérico por cores explícitas:
- `bg-card` → `bg-white`
- `border-border` → `border-gray-200`
- `text-foreground` → `text-gray-800`
- `text-muted-foreground` → `text-gray-500`
- `bg-muted/50` → `bg-gray-50`

Isso corrige o popup escuro com texto escuro.

#### 3. Redesign dos Product Cards em `AreaMembrosPublica.tsx`

Cards mais ricos com:
- **Barra de progresso** embaixo do nome (ex: "3 de 5 materiais acessados")
- **Indicador visual**: círculo de progresso ao lado da imagem do produto
- **Último acesso**: "Você parou na página 12 de 30" ou "Assistiu 45% do vídeo"
- **Texto da IA personalizado** antes dos cards: uma mensagem de progresso gerada pela IA que diz onde a pessoa está e o que fazer agora

Estrutura do card:
```text
┌──────────────────────────────────────┐
│ [IMG+%]  Água que Cura              │
│          ✓ Liberado recentemente     │
│          ████████░░░ 3/5 materiais   │
│          📖 Parou na página 12 de 30 │
└──────────────────────────────────────┘
```

#### 4. Salvar progresso no `PdfViewer` e nos vídeos

- **PDF**: Ao mudar de página no PdfViewer, fazer upsert na `member_content_progress` com `current_page` e `total_pages`. Passar `phone` como prop.
- **Vídeo**: No `MaterialCard`, ao `onTimeUpdate` do `<video>`, salvar `video_seconds` e `video_duration`.

#### 5. Texto personalizado da IA com progresso

Atualizar `member-ai-context/index.ts`:
- Receber dados de progresso no payload (materiais acessados, páginas lidas, % concluído)
- Adicionar ao prompt: "A pessoa está na página X de Y do material Z. Sugira o próximo passo."
- Gerar um novo campo `progressMessage` com orientação personalizada

Na página, exibir `progressMessage` como um card de destaque antes da lista de produtos:
```text
┌─────────────────────────────────────────┐
│ 💡 Junior, você já leu 12 páginas do    │
│ "Água que Cura". Continue de onde       │
│ parou — faltam apenas 18 páginas!       │
└─────────────────────────────────────────┘
```

#### 6. `AreaMembrosPublica.tsx` — Carregar progresso

- Buscar `member_content_progress` para todos os materiais do membro
- Calcular % por produto (materiais acessados / total)
- Passar dados de progresso para a IA e para os cards

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar tabela `member_content_progress` |
| `src/components/membros/MaterialCard.tsx` | Corrigir cores para branco/claro, salvar progresso de vídeo |
| `src/components/membros/ProductContentViewer.tsx` | Cores claras |
| `src/components/membros/PdfViewer.tsx` | Salvar progresso de página |
| `src/pages/AreaMembrosPublica.tsx` | Carregar progresso, cards com barra de progresso, mensagem IA de progresso |
| `supabase/functions/member-ai-context/index.ts` | Receber e usar dados de progresso no prompt |

