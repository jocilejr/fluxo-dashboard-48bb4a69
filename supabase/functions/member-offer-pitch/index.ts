import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { firstName, offerName, offerDescription, ownedProductNames, profile, offerMaterials } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [openaiRes, settingsRes] = await Promise.all([
      supabase.from("openai_settings").select("api_key").limit(1).maybeSingle(),
      supabase.from("member_area_settings").select("ai_persona_prompt").limit(1).maybeSingle(),
    ]);

    if (openaiRes.error || !openaiRes.data?.api_key) {
      throw new Error("OpenAI API key not configured.");
    }

    const personaPrompt = settingsRes.data?.ai_persona_prompt || "";

    const prof = profile || {};
    let memberDays = 0;
    if (prof.memberSince) {
      memberDays = Math.floor((Date.now() - new Date(prof.memberSince).getTime()) / (1000 * 60 * 60 * 24));
    }

    let profileCategory = "regular";
    if (memberDays <= 7) profileCategory = "novo";
    else if (prof.daysSinceLastAccess !== null && prof.daysSinceLastAccess > 7) profileCategory = "inativo";
    else if (prof.totalPaid > 200 || prof.totalProducts >= 3) profileCategory = "fiel";

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum";

    const personaBlock = personaPrompt
      ? `SUA PERSONALIDADE:\n${personaPrompt}`
      : `SUA PERSONALIDADE:\nVocê é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Você age de forma cristã e nunca tenta vender algo — você oferece com carinho algo que pode fazer sentido para a pessoa, e pede uma contribuição caso a pessoa possa contribuir.`;

    const systemPrompt = `Você vai gerar mensagens de chat simulando uma conversa pessoal sobre um material que a pessoa demonstrou interesse.

${personaBlock}

REGRAS ABSOLUTAS:
- NUNCA mencione valores, preços ou "por apenas R$..."
- NUNCA use termos de marketing como "insights", "mindset", "jornada transformadora", "desbloqueie", "exclusivo"
- Fale de forma natural, como uma amiga que conhece a pessoa
- Baseie-se APENAS no título e descrição da oferta para explicar o que é
- Use o nome da pessoa
- Gere EXATAMENTE 2 mensagens curtas (como balões de WhatsApp)
- Cada mensagem deve ter no máximo 2 frases
- A primeira mensagem deve ser pessoal e acolhedora, e deve mencionar que os materiais que ela já possui são: ${ownedNames}. Diga que ela ainda não contribuiu para receber "${offerName}", de forma carinhosa e sem pressão.
- A segunda mensagem deve explicar brevemente o que é o material com base na descrição, e convidar com gentileza.

PERFIL DA PESSOA:
- Nome: ${firstName}
- Membro há: ${memberDays} dias${memberDays <= 7 ? " (nova)" : ""}
- Produtos que já possui: ${ownedNames}
- Categoria: ${profileCategory}
${profileCategory === "novo" ? "→ É nova, não pressione. Mostre que é um próximo passo natural." : ""}
${profileCategory === "inativo" ? "→ Está voltando. Incentive com carinho." : ""}
${profileCategory === "fiel" ? "→ É fiel e comprometida. Reconheça isso." : ""}

MATERIAL CLICADO:
- Nome: "${offerName}"
- Descrição: "${offerDescription || 'Material especial preparado com muito carinho.'}"
${(offerMaterials && offerMaterials.length > 0) ? `\nCONTEÚDO QUE A PESSOA VAI RECEBER:\n${offerMaterials.join("\n")}\n\n→ Na segunda mensagem, mencione ESPECIFICAMENTE alguns dos materiais/módulos que ela vai receber (use os nomes reais listados acima). Isso torna a oferta concreta e tangível.` : ""}

Gere as mensagens usando a função fornecida.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiRes.data.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere as mensagens de chat para ${firstName} sobre "${offerName}".` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_offer_chat",
              description: "Generate exactly 2 chat messages simulating a personal conversation about the offer.",
              parameters: {
                type: "object",
                properties: {
                  messages: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of exactly 2 short chat messages, each max 2 sentences.",
                    minItems: 2,
                    maxItems: 2,
                  }
                },
                required: ["messages"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_offer_chat" } },
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
    console.error("member-offer-pitch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
