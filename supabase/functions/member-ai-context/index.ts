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
        `[ID: ${o.id}] "${o.name}"${o.description ? ` - ${o.description}` : ""}${o.categoryTag ? ` (categoria: ${o.categoryTag})` : ""}`)
      .join("\n- ");

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum produto identificado";

    const systemPrompt = `Você é um assistente espiritual personalizado para uma área de membros cristã. Você deve gerar 3 blocos de conteúdo em uma única resposta usando a função fornecida.

REGRAS IMPORTANTES:
1. SAUDAÇÃO (greeting): Máximo 2 frases. Pessoal, acolhedora. Mencione um produto/material específico que a pessoa possui e sugira retomar de onde parou. Tom religioso sutil. Use 1-2 emojis.

2. MENSAGEM PESSOAL (tip): Uma mensagem CONVERSACIONAL e DIRETA, como se fosse de um amigo próximo. NÃO pareça uma dica genérica. Fale diretamente com a pessoa pelo nome, mencione os materiais específicos que ela está praticando e faça uma pergunta ou comentário pessoal. Exemplo: "${firstName}, você está praticando dois materiais incríveis, está conseguindo seguir o passo a passo certinho?" Máximo 2 frases. Tom íntimo e pessoal.

3. SUGESTÃO DE OFERTA (offerSuggestion): Analise os produtos que a pessoa JÁ TEM e sugira UMA oferta que COMPLEMENTE a jornada dela. A mensagem DEVE mencionar explicitamente os nomes dos produtos que a pessoa já contribuiu (${ownedNames}) e explicar que este novo material é especial mas ela ainda não contribuiu para recebê-lo. Exemplo: "Você já contribuiu com [Produto A] e [Produto B], que são incríveis! Este material complementa perfeitamente sua jornada..." Se não houver ofertas ou nenhuma fizer sentido, retorne offerId vazio e message vazia.

NUNCA seja genérico. Cada resposta deve parecer que foi escrita por alguém que conhece a pessoa.`;

    const userPrompt = `Nome: ${firstName || "Querido(a)"}

Produtos que a pessoa já contribuiu e possui:
- ${productList || "Nenhum produto específico"}

Nomes dos produtos adquiridos: ${ownedNames}

Ofertas disponíveis para sugestão (produtos que ela AINDA NÃO tem):
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
                    description: "Conversational personal message (NOT a generic tip), mentioning the person by name and their specific materials."
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
                        description: "Personalized message mentioning the products they already own and explaining why this new offer complements their journey."
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
