import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { firstName, products, offers, ownedProductNames } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from("openai_settings")
      .select("api_key")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.api_key) {
      throw new Error("OpenAI API key not configured. Add it in Configurações > OpenAI.");
    }

    const OPENAI_API_KEY = settings.api_key;

    const productList = (products || [])
      .map((p: { name: string; materials: string[] }) => 
        `"${p.name}" (materiais: ${p.materials?.length ? p.materials.join(", ") : "sem materiais cadastrados"})`)
      .join("\n- ");

    const offerList = (offers || [])
      .map((o: { id: string; name: string; description: string | null; categoryTag: string | null }) => 
        `[ID: ${o.id}] Nome: "${o.name}" — Descrição: "${o.description || 'Sem descrição'}"${o.categoryTag ? ` (categoria: ${o.categoryTag})` : ""}`)
      .join("\n- ");

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum produto identificado";

    const systemPrompt = `Você é um copywriter especialista em conversão e vendas para uma área de membros cristã. Sua missão é gerar textos que pareçam escritos por um amigo próximo que conhece profundamente a pessoa. Gere 3 blocos usando a função fornecida.

REGRAS ABSOLUTAS:
- NUNCA use termos genéricos como "este material", "este conteúdo", "este produto"
- SEMPRE cite nomes EXATOS dos produtos e ofertas
- Tom: amigo próximo, íntimo, direto — NUNCA robótico ou formal
- Máximo 2 frases por bloco (greeting e tip)

1. SAUDAÇÃO (greeting): Cumprimento pessoal usando o nome. Mencione UM material específico que a pessoa possui e sugira retomar. Use 1 emoji. Máx 2 frases curtas.

2. MENSAGEM PESSOAL (tip): Fale DIRETAMENTE com a pessoa pelo nome. Mencione os materiais específicos que ela pratica. Faça uma pergunta ou comentário pessoal como se fosse um amigo. Exemplo: "${firstName}, você tem dois materiais poderosos em mãos — está conseguindo aplicar o passo a passo?" Máx 2 frases. NUNCA pareça uma "dica do dia".

3. SUGESTÃO DE OFERTA (offerSuggestion): Esta é a mais importante para CONVERSÃO.
   - Analise TODAS as ofertas disponíveis e escolha a que melhor complementa os produtos que a pessoa JÁ TEM
   - A mensagem DEVE:
     a) Citar os nomes EXATOS dos produtos que a pessoa já contribuiu (${ownedNames})
     b) Citar o NOME EXATO da oferta sugerida
     c) Usar a DESCRIÇÃO da oferta para explicar o que ela oferece de concreto
     d) Explicar POR QUE esta oferta complementa especificamente o que a pessoa já tem
     e) Criar desejo genuíno, não pressão
   - Exemplo: "Você já está praticando 'Oração dos 21 Dias' e 'Jejum Guiado', que são transformadores! O '${offers?.[0]?.name || "Devocional Profundo"}' complementa perfeitamente porque [usar descrição da oferta]. É como adicionar uma nova camada à sua prática."
   - Se nenhuma oferta fizer sentido, retorne offerId e message vazios.
   - A mensagem deve ter 2-3 frases, persuasiva mas genuína.`;

    const userPrompt = `Nome: ${firstName || "Querido(a)"}

Produtos que a pessoa já contribuiu e possui acesso:
- ${productList || "Nenhum produto específico"}

Nomes dos produtos adquiridos: ${ownedNames}

Ofertas disponíveis para sugestão (a pessoa NÃO tem acesso a estes — são oportunidades de venda):
- ${offerList || "Nenhuma oferta disponível"}

IMPORTANTE: Use o nome e a descrição de cada oferta ao criar a mensagem de sugestão. A mensagem deve citar explicitamente o nome da oferta escolhida e usar sua descrição para justificar a recomendação.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_member_context",
              description: "Generate 3 personalized AI content blocks for the member area.",
              parameters: {
                type: "object",
                properties: {
                  greeting: {
                    type: "string",
                    description: "Personalized greeting message, max 2 sentences."
                  },
                  tip: {
                    type: "string",
                    description: "Conversational personal message mentioning the person by name and their specific materials. NOT a generic tip."
                  },
                  offerSuggestion: {
                    type: "object",
                    properties: {
                      offerId: {
                        type: "string",
                        description: "The ID of the suggested offer, or empty string if none."
                      },
                      message: {
                        type: "string",
                        description: "Persuasive sales copy that mentions: (1) the exact names of products the user already owns, (2) the exact name of the suggested offer, (3) details from the offer's description to justify the recommendation. 2-3 sentences."
                      }
                    },
                    required: ["offerId", "message"]
                  }
                },
                required: ["greeting", "tip", "offerSuggestion"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_member_context" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI API error:", response.status, t);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call response from OpenAI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("member-ai-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
