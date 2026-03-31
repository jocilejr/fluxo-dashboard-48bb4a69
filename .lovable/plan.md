

## Plano: Preview WhatsApp preenchendo a coluna sem espaço vazio

### Problema
O mockup de celular atual tem 260px fixos e fica centralizado, deixando muito espaço vazio ao redor. A segunda imagem de referência mostra o preview ocupando toda a coluna direita, integrado e sem moldura de celular.

### Mudanças

1. **Substituir `WhatsAppMobilePreview` (mockup de celular)** por um preview estilo painel que preenche toda a coluna:
   - Header com avatar + nome do contato (estilo WhatsApp, mas sem moldura de celular/status bar/home indicator)
   - Área de chat com fundo escuro `#0b141a` preenchendo o espaço disponível (`flex-1`)
   - Chip "HOJE", mensagem recebida, mensagem enviada com variáveis renderizadas
   - Barra de input no rodapé
   - **Sem bordas arredondadas de celular, sem status bar, sem home indicator**
   - O container usa `h-full` para preencher a coluna inteira

2. **Ajustar o grid** para `md:grid-cols-[1fr,320px]` — editor ocupa o espaço restante, preview tem largura fixa de 320px e altura total do card

3. **Preview com altura vinculada ao card** — usar `flex flex-col h-full` para que header, chat e input bar se distribuam verticalmente sem sobrar espaço

4. **Placeholder quando sem mensagem** — texto centralizado "Componha uma mensagem para ver o preview" (como na imagem 2)

### Arquivo alterado
- `src/pages/AutoRecuperacao.tsx`

