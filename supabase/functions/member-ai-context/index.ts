import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { firstName, products, offers } = await req.json();

    // Fetch OpenAI API key from openai_settings table
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
        `[ID: ${o.id}] "${o.name}"${o.description ? ` - ${o.description}` : ""}${o.categoryTag ? ` (categoria: ${o.categoryTag})` : ""}`)
      .join("\n- ");

    const systemPrompt = `Você é um assistente espiritual personalizado para uma área de membros cristã. Você deve gerar 3 blocos de conteúdo em uma única resposta usando a função fornecida.

REGRAS IMPORTANTES:
1. SAUDAÇÃO (greeting): Máximo 2 frases. Pessoal, acolhedora. Mencione um produto/material específico que a pessoa possui e sugira retomar de onde parou. Tom religioso sutil. Use 1-2 emojis.

2. DICA CONTEXTUAL (tip): Uma dica ESPECÍFICA e prática relacionada ao material que a pessoa está praticando. Não seja genérico. Exemplo: "Ao estudar o Salmo 23, experimente meditar em cada verso por 5 minutos antes de dormir". Máximo 2 frases.

3. SUGESTÃO DE OFERTA (offerSuggestion): Analise os produtos que a pessoa JÁ TEM e sugira UMA oferta que COMPLEMENTE a jornada dela. A mensagem deve explicar POR QUE esse material específico é o próximo passo natural. Se não houver ofertas ou nenhuma fizer sentido, retorne offerId vazio e message vazia.

NUNCA seja genérico. Cada resposta deve parecer que foi escrita por alguém que conhece a pessoa.`;

    const userPrompt = `Nome: ${firstName || "Querido(a)"}

Produtos que a pessoa possui:
- ${productList || "Nenhum produto específico"}

Ofertas disponíveis para sugestão:
- ${offerList || "Nenhuma oferta disponível"}`;

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
                    description: "Specific contextual tip about the material the person is practicing."
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
                        description: "Personalized message explaining why this offer complements their journey."
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
