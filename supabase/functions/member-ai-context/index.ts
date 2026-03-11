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

    const productList = (products || [])
      .map((p: { name: string; materials: string[] }) => 
        `"${p.name}" (materiais: ${p.materials?.length ? p.materials.join(", ") : "sem materiais cadastrados"})`)
      .join("\n- ");

    const offerList = (offers || [])
      .map((o: { id: string; name: string; description: string | null; categoryTag: string | null }) => 
        `[ID: ${o.id}] Nome: "${o.name}" — Descrição: "${o.description || 'Sem descrição'}"${o.categoryTag ? ` (categoria: ${o.categoryTag})` : ""}`)
      .join("\n- ");

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum produto identificado";

    // Build progress context
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

    // Build profile context
    const prof = profile || {};
    let memberSinceStr = "desconhecido";
    let memberDays = 0;
    if (prof.memberSince) {
      const sinceDate = new Date(prof.memberSince);
      memberDays = Math.floor((Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24));
      memberSinceStr = `${memberDays} dias atrás`;
    }
    const totalPaid = prof.totalPaid || 0;
    const totalTransactions = prof.totalTransactions || 0;
    const totalProducts = prof.totalProducts || 0;
    const daysSinceLastAccess = prof.daysSinceLastAccess;

    let profileCategory = "regular";
    if (memberDays <= 7) profileCategory = "novo";
    else if (daysSinceLastAccess !== null && daysSinceLastAccess > 7) profileCategory = "inativo";
    else if (totalPaid > 200 || totalProducts >= 3) profileCategory = "fiel";

    const profileContext = `PERFIL DO MEMBRO:
- Membro há: ${memberSinceStr}${memberDays <= 7 ? " (MEMBRO NOVA!)" : ""}
- Total contribuído: R$ ${totalPaid.toFixed(2)}
- Número de transações: ${totalTransactions}
- Produtos que possui: ${totalProducts}
- Dias sem acessar materiais: ${daysSinceLastAccess !== null ? daysSinceLastAccess : "nunca acessou"}${daysSinceLastAccess !== null && daysSinceLastAccess > 3 ? " (ESTÁ SUMIDA!)" : ""}
- Categoria: ${profileCategory === "novo" ? "NOVA — precisa de acolhimento" : profileCategory === "inativo" ? "INATIVA — precisa de re-engajamento" : profileCategory === "fiel" ? "FIEL — merece reconhecimento" : "REGULAR"}`;

    const systemPrompt = `Você é um copywriter especialista para uma área de membros cristã. Sua missão é gerar textos que pareçam escritos por um amigo próximo que conhece profundamente a pessoa. Gere 3 blocos usando a função fornecida.

PASSO 1 — ANALISE O PERFIL COMPLETO DA PESSOA antes de escrever qualquer coisa:
- Quanto tempo ela é membro? (nova vs veterana)
- Está ativa ou sumiu? (quantos dias sem acessar?)
- Quantos produtos possui? (comprometimento)
- Onde parou nos materiais? (progresso)

PASSO 2 — ADAPTE O TOM baseado no perfil:
${profileCategory === "novo" ? `🌟 MEMBRO NOVA: Dê boas-vindas CALOROSAS. Mostre que ela fez a escolha certa. Guie os primeiros passos. Use frases como "Que alegria ter você aqui!", "Você tomou uma decisão linda!".` : ""}
${profileCategory === "inativo" ? `💜 MEMBRO INATIVA: Mostre que sentiu falta dela. NÃO critique a ausência. Use saudade genuína. Frases como "Que bom te ver de volta!", "Sentimos sua falta!". Lembre-a do que ela já conquistou.` : ""}
${profileCategory === "fiel" ? `👑 MEMBRO FIEL: Reconheça a dedicação e fidelidade. Valorize o comprometimento. Frases como "Você é uma das nossas membros mais dedicadas!", "Sua jornada é inspiradora!".` : ""}
${profileCategory === "regular" ? `😊 MEMBRO REGULAR: Tom amigável e encorajador. Incentive a continuar e explore o que ela ainda não viu.` : ""}

REGRAS ABSOLUTAS:
- NUNCA use termos genéricos como "este material", "este conteúdo", "este produto"
- SEMPRE cite nomes EXATOS dos produtos e materiais
- Tom: amigo próximo, íntimo, direto — NUNCA robótico ou formal
- Máximo 2 frases por bloco (greeting e tip)
- PERSONALIZE com base no perfil — não dê respostas genéricas
- NUNCA mencione valores, preços ou ofertas

1. SAUDAÇÃO (greeting): Cumprimento pessoal usando o nome. Adapte ao perfil (nova? sumida? fiel?). Use 1 emoji. Máx 2 frases curtas.

2. MENSAGEM PESSOAL (tip): Fale DIRETAMENTE com a pessoa pelo nome. Baseie-se no PERFIL COMPLETO. Faça uma pergunta ou comentário pessoal como se fosse um amigo. Máx 2 frases. NUNCA pareça uma "dica do dia".

3. MENSAGEM DE PROGRESSO (progressMessage): Analise o progresso E o perfil. Se não há progresso, sugira por onde começar. Se há progresso, cite onde parou. Se está inativa, relembre o que já conquistou. 2-3 frases. Use emoji relevante.`;

    const userPrompt = `Nome: ${firstName || "Querido(a)"}

${profileContext}

Produtos que a pessoa já possui acesso:
- ${productList || "Nenhum produto específico"}

Nomes dos produtos adquiridos: ${ownedNames}

PROGRESSO NOS MATERIAIS (onde a pessoa parou):
- ${progressContext}

IMPORTANTE: Use o PERFIL COMPLETO + PROGRESSO para personalizar TODOS os blocos. A pessoa deve sentir que você a conhece de verdade.`;

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
                  progressMessage: {
                    type: "string",
                    description: "Personalized progress message citing exactly where the person stopped and suggesting the next concrete step. 2-3 sentences."
                  }
                },
                required: ["greeting", "tip", "progressMessage"]
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
