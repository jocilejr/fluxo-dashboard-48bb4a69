

## Área de Membros Personalizada

### Conceito

Uma página pública acessível via URL com o telefone do cliente (ex: `seudominio.com/membros/89981340810`). Sem login, sem senha. O telefone na URL identifica o cliente e mostra seus produtos comprados + ofertas adicionais.

### O que será construído

**1. Banco de dados**

- Nova tabela `member_products`: vincula um telefone (normalizado) a um produto liberado, com campos como `normalized_phone`, `product_id` (referência a `delivery_products`), `granted_at`, `is_active`
- Nova tabela `member_area_settings`: configurações gerais da área de membros (título, logo, mensagem de boas-vindas, cor do tema)
- Nova tabela `member_area_offers`: produtos exibidos como "ofertas adicionais" para quem já é membro (nome, descrição, imagem, link de compra, ordem)

**2. Página pública da área de membros**

- Rota: `/membros/:phone` (pública, sem autenticação)
- Busca o telefone na URL, normaliza, e consulta `member_products` usando variações de telefone (mesma lógica já existente com `generate_phone_variations`)
- Exibe:
  - Saudação personalizada com nome do cliente (puxado da tabela `customers`)
  - Cards dos produtos liberados com botão de acesso (link/redirect configurável)
  - Seção de "Ofertas exclusivas" com produtos adicionais para compra
- Design responsivo e bonito, sem necessidade de login

**3. Administração no dashboard**

- Nova página `/area-membros` no dashboard (protegida)
- Funcionalidades:
  - Gerenciar produtos da área de membros (liberar/revogar acesso por telefone)
  - Configurar aparência (logo, cores, mensagens)
  - Gerenciar ofertas adicionais
  - Buscar membros por telefone
- Link na sidebar acima de "Recolher", com ícone diferenciado (ex: `Crown` ou `UserCheck`)

**4. Sidebar**

- Novo item fixo acima do botão "Recolher" no `AppSidebar.tsx`, separado visualmente dos demais itens do menu
- Disponível para admins

### Fluxo

```text
Admin libera produto → member_products (phone + product_id)
                          ↓
Cliente acessa /membros/89981340810
                          ↓
Sistema normaliza phone → busca variações → encontra produtos
                          ↓
Exibe produtos liberados + ofertas adicionais
```

### Arquivos envolvidos

- **Novo**: `src/pages/AreaMembros.tsx` (admin)
- **Novo**: `src/pages/AreaMembrosPublica.tsx` (página pública)
- **Novo**: `src/components/membros/` (componentes da área)
- **Editado**: `src/App.tsx` (novas rotas)
- **Editado**: `src/components/AppSidebar.tsx` (novo link na sidebar)
- **Migração SQL**: 3 novas tabelas com RLS

### Segurança

- Página pública não requer autenticação (acesso por telefone)
- RLS nas tabelas de membros: admins gerenciam, service role insere, público pode ler (apenas seus próprios dados via phone match)
- Administração protegida por role admin

