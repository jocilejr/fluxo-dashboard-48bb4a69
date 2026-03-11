import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { firstName, offerName, offerDescription, ownedProductNames, profile } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from("openai_settings")
      .select("api_key")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.api_key) {
      throw new Error("OpenAI API key not configured.");
    }

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

    const systemPrompt = `Você é uma copywriter especialista em conversão para uma área de membros cristã. A pessoa clicou em um material bloqueado — ela tem INTERESSE. Sua missão é criar uma copy persuasiva e pessoal para convencê-la a adquirir.

REGRAS ABSOLUTAS:
- NUNCA mencione valores, preços ou "por apenas R$..."
- NUNCA use termos genéricos — cite o NOME EXATO da oferta
- Tom: amiga próxima, íntima, como se conhecesse a pessoa há anos
- Máximo 3 frases curtas e impactantes
- Use o nome da pessoa
- Conecte a oferta com o que ela JÁ possui (mostre complementaridade)

PERFIL DA PESSOA:
- Nome: ${firstName}
- Membro há: ${memberDays} dias${memberDays <= 7 ? " (NOVA)" : ""}
- Produtos que já possui: ${ownedNames}
- Categoria: ${profileCategory}
${profileCategory === "novo" ? "→ É nova, não pressione. Mostre que é um próximo passo natural." : ""}
${profileCategory === "inativo" ? "→ Está voltando. Incentive com carinho." : ""}
${profileCategory === "fiel" ? "→ É fiel e comprometida. Reconheça isso e mostre como complementa sua jornada." : ""}

OFERTA CLICADA:
- Nome: "${offerName}"
- Descrição: "${offerDescription || 'Conteúdo exclusivo para complementar sua jornada.'}"

Gere a copy usando a função fornecida.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere a copy persuasiva para ${firstName} sobre "${offerName}".` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_offer_pitch",
              description: "Generate a persuasive pitch for a locked offer.",
              parameters: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "Persuasive copy, max 3 sentences. Personal, warm, no prices."
                  }
                },
                required: ["message"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_offer_pitch" } },
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
