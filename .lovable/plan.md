

## Redesign: Chat da Meire Rosana + Header Simplificado

### O que muda

**Header**: Remove a frase/saudação do header. Fica apenas "Olá, {nome}" sem subtítulo.

**Novo componente de chat**: Abaixo do header, um mini-chat simulando uma conversa com "Meire Rosana":
- Avatar circular com a foto enviada (salva em `src/assets/meire-rosana.png`)
- Nome "Meire Rosana" ao lado do avatar
- Balão de mensagem estilo WhatsApp com a mensagem da IA (greeting + progressMessage + tip combinados)
- Enquanto a IA carrega: animação "digitando..." com 3 pontinhos pulsantes
- Estilo: fundo levemente colorido no balão, cantos arredondados, sombra suave

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/assets/meire-rosana.png` | Copiar foto enviada |
| `src/pages/AreaMembrosPublica.tsx` | Remover subtítulo do header, substituir bloco de AI progress por chat bubble da Meire Rosana com "digitando..." |
| `src/pages/AreaMembros.tsx` (MemberPreviewTab) | Espelhar as mesmas mudanças no preview estático |

### Layout do chat bubble

```text
┌─────────────────────────────────────┐
│  Olá, Maria                        │  ← header simples
├─────────────────────────────────────┤
│  (●) Meire Rosana                   │
│  ┌────────────────────────────┐     │
│  │ Maria, você parou na pág   │     │
│  │ 12 do "Água que Cura"...   │     │
│  │ Continue de onde parou! 💪 │     │
│  └────────────────────────────┘     │
│                                     │
│  [Product cards...]                 │
└─────────────────────────────────────┘
```

Enquanto carrega:
```text
│  (●) Meire Rosana                   │
│  ┌──────────────┐                   │
│  │ digitando... │  ← dots animados  │
│  └──────────────┘                   │
```

### Detalhes técnicos

- A foto será importada via `import meirePhoto from "@/assets/meire-rosana.png"`
- O balão combina `aiContext.greeting`, `aiContext.progressMessage` e `aiContext.tip` em mensagens separadas (como múltiplas mensagens no chat)
- Animação de "digitando" usa CSS keyframes com 3 dots que pulsam
- No preview (AreaMembros.tsx), mostra mensagem mock fixa no mesmo estilo de chat

