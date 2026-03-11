import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { firstName, products, ownedProductNames, progress, profile } = await req.json();

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

    // Load persona prompt
    const { data: memberSettings } = await supabase
      .from("member_area_settings")
      .select("ai_persona_prompt")
      .limit(1)
      .maybeSingle();

    const personaPrompt = memberSettings?.ai_persona_prompt || "";

    const productList = (products || [])
      .map((p: { name: string; materials: string[] }) => 
        `"${p.name}" (materiais: ${p.materials?.length ? p.materials.join(", ") : "sem materiais cadastrados"})`)
      .join("\n- ");

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum produto identificado";

    const progressItems = (progress || []) as Array<{
      materialName: string;
      type: string;
      currentPage: number;
      totalPages: number;
      videoSeconds: number;
      videoDuration: number;
    }>;

    let progressContext = "Nenhum progresso registrado ainda.";
    if (progressItems.length > 0) {
      progressContext = progressItems.map(p => {
        if (p.type === "pdf" && p.totalPages > 0) {
          const pct = Math.round((p.currentPage / p.totalPages) * 100);
          return `"${p.materialName}": leu ${p.currentPage} de ${p.totalPages} páginas (${pct}%)`;
        }
        if (p.type === "video" && p.videoDuration > 0) {
          const pct = Math.round((p.videoSeconds / p.videoDuration) * 100);
          const mins = Math.floor(p.videoSeconds / 60);
          return `"${p.materialName}": assistiu ${mins} minutos (${pct}%)`;
        }
        return `"${p.materialName}": acessado`;
      }).join("\n- ");
    }

    const prof = profile || {};
    let memberSinceStr = "desconhecido";
    let memberDays = 0;
    if (prof.memberSince) {
      const sinceDate = new Date(prof.memberSince);
      memberDays = Math.floor((Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24));
      memberSinceStr = `${memberDays} dias atrás`;
    }
    const totalProducts = prof.totalProducts || 0;
    const daysSinceLastAccess = prof.daysSinceLastAccess;

    let profileCategory = "regular";
    if (memberDays <= 7) profileCategory = "novo";
    else if (daysSinceLastAccess !== null && daysSinceLastAccess > 7) profileCategory = "inativo";
    else if ((prof.totalPaid || 0) > 200 || totalProducts >= 3) profileCategory = "fiel";

    const profileContext = `PERFIL DO MEMBRO:
- Membro há: ${memberSinceStr}${memberDays <= 7 ? " (MEMBRO NOVA!)" : ""}
- Produtos que possui: ${totalProducts}
- Dias sem acessar materiais: ${daysSinceLastAccess !== null ? daysSinceLastAccess : "nunca acessou"}${daysSinceLastAccess !== null && daysSinceLastAccess > 3 ? " (ESTÁ SUMIDA!)" : ""}
- Categoria: ${profileCategory === "novo" ? "NOVA — precisa de acolhimento" : profileCategory === "inativo" ? "INATIVA — precisa de re-engajamento" : profileCategory === "fiel" ? "FIEL — merece reconhecimento" : "REGULAR"}`;

    const personaBlock = personaPrompt 
      ? `\nSUA PERSONALIDADE:\n${personaPrompt}\n` 
      : `\nVocê é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Fala com carinho, como uma amiga próxima. Nunca usa termos de marketing.\n`;

    const systemPrompt = `Você gera mensagens para uma área de membros cristã. Gere EXATAMENTE 2 blocos usando a função fornecida.
${personaBlock}
ADAPTE O TOM ao perfil:
${profileCategory === "novo" ? `🌟 MEMBRO NOVA: Boas-vindas calorosas. Mostre que fez a escolha certa.` : ""}
${profileCategory === "inativo" ? `💜 MEMBRO INATIVA: Mostre que sentiu falta. NÃO critique a ausência.` : ""}
${profileCategory === "fiel" ? `👑 MEMBRO FIEL: Reconheça a dedicação e fidelidade.` : ""}
${profileCategory === "regular" ? `😊 MEMBRO REGULAR: Tom amigável e encorajador.` : ""}

REGRAS:
- NUNCA use termos genéricos como "este material", "este conteúdo"
- SEMPRE cite nomes EXATOS dos produtos e materiais
- Tom: amiga próxima, íntima — NUNCA robótico ou formal
- NUNCA use termos de marketing como "insights", "mindset", "jornada transformadora"
- NUNCA mencione valores ou preços
- Máximo 2 frases por bloco
- VARIE: ora foque no progresso, ora no perfil, ora num incentivo carinhoso — nunca repita a mesma estrutura

1. SAUDAÇÃO (greeting): Cumprimento pessoal usando o nome. Adapte ao perfil. Use 1 emoji. Máx 2 frases curtas.
2. MENSAGEM PESSOAL (tip): Baseie-se no progresso ou perfil. Pode ser encorajamento, lembrete de onde parou, ou comentário carinhoso. Máx 2 frases.`;

    const userPrompt = `Nome: ${firstName || "Querido(a)"}

${profileContext}

Produtos com acesso:
- ${productList || "Nenhum produto específico"}

Nomes dos produtos: ${ownedNames}

PROGRESSO:
- ${progressContext}`;

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
              description: "Generate 2 personalized AI content blocks for the member area.",
              parameters: {
                type: "object",
                properties: {
                  greeting: {
                    type: "string",
                    description: "Personalized greeting message, max 2 sentences."
                  },
                  tip: {
                    type: "string",
                    description: "Personal message about progress, encouragement, or a warm comment. Max 2 sentences."
                  }
                },
                required: ["greeting", "tip"]
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
