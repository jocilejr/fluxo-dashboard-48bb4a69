import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product_id } = await req.json();
    if (!product_id) throw new Error("product_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for OpenAI key first, fall back to Lovable AI
    const { data: openaiSettings } = await supabase
      .from("openai_settings")
      .select("api_key")
      .limit(1)
      .maybeSingle();

    const useOpenAI = !!openaiSettings?.api_key;

    // Fetch product info
    const { data: product } = await supabase
      .from("delivery_products")
      .select("id, name")
      .eq("id", product_id)
      .single();

    if (!product) throw new Error("Product not found");

    // Fetch all materials for this product
    const [catsRes, matsRes] = await Promise.all([
      supabase.from("member_product_categories").select("id, name").eq("product_id", product_id).order("sort_order"),
      supabase.from("member_product_materials").select("title, description, content_type, content_text, category_id").eq("product_id", product_id).order("sort_order"),
    ]);

    const cats = catsRes.data || [];
    const mats = matsRes.data || [];

    if (mats.length === 0) {
      throw new Error("Nenhum material encontrado para este produto");
    }

    // Build content description from materials
    const catMap = new Map(cats.map((c: any) => [c.id, c.name]));
    const contentParts: string[] = [];

    contentParts.push(`Produto: "${product.name}"`);
    contentParts.push(`Total de materiais: ${mats.length}`);
    contentParts.push("");

    for (const mat of mats) {
      const catName = mat.category_id ? (catMap.get(mat.category_id) || "Sem categoria") : "Sem categoria";
      let line = `- [${catName}] ${mat.title}`;
      if (mat.description) line += ` — ${mat.description}`;
      if (mat.content_text) {
        // Include first 500 chars of text content
        const textPreview = mat.content_text.substring(0, 500);
        line += `\n  Conteúdo: ${textPreview}`;
      }
      contentParts.push(line);
    }

    const materialsList = contentParts.join("\n");

    const systemPrompt = `Você é um especialista em análise de conteúdo educacional cristão. Analise os materiais de um produto digital e gere:
1. Um resumo conciso (3-5 frases) do CONHECIMENTO e ENSINAMENTOS principais que a pessoa adquire ao estudar esse material
2. Uma lista de 5-10 tópicos-chave que a pessoa aprendeu

REGRAS:
- Foque no CONHECIMENTO adquirido, não na estrutura do material
- Use linguagem acessível e acolhedora
- Não mencione preços ou aspectos comerciais
- Refira-se aos ensinamentos de forma concreta (ex: "oração intercessora", "louvor de adoração", "estudo dos Salmos")
- O resumo deve permitir que alguém diga "Você já estudou sobre X, Y e Z..."`;

    const userPrompt = `Analise os seguintes materiais do produto "${product.name}" e extraia o conhecimento principal:\n\n${materialsList}`;

    let summary = "";
    let keyTopics: string[] = [];

    if (useOpenAI) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiSettings.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_knowledge_summary",
              description: "Save the extracted knowledge summary and key topics",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "3-5 sentence summary of key knowledge acquired" },
                  key_topics: { type: "array", items: { type: "string" }, description: "5-10 key topics learned", minItems: 3, maxItems: 10 },
                },
                required: ["summary", "key_topics"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "save_knowledge_summary" } },
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("OpenAI error:", response.status, t);
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("No tool call response");
      const result = JSON.parse(toolCall.function.arguments);
      summary = result.summary;
      keyTopics = result.key_topics;
    } else if (lovableApiKey) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_knowledge_summary",
              description: "Save the extracted knowledge summary and key topics",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "3-5 sentence summary of key knowledge acquired" },
                  key_topics: { type: "array", items: { type: "string" }, description: "5-10 key topics learned", minItems: 3, maxItems: 10 },
                },
                required: ["summary", "key_topics"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "save_knowledge_summary" } },
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Lovable AI error:", response.status, t);
        if (response.status === 429) throw new Error("Rate limit exceeded, tente novamente em alguns segundos");
        if (response.status === 402) throw new Error("Créditos insuficientes");
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("No tool call response");
      const result = JSON.parse(toolCall.function.arguments);
      summary = result.summary;
      keyTopics = result.key_topics;
    } else {
      throw new Error("Nenhuma API de IA configurada. Configure a OpenAI nas configurações.");
    }

    // Upsert into product_knowledge_summaries
    const { error: upsertError } = await supabase
      .from("product_knowledge_summaries")
      .upsert({
        product_id,
        summary,
        key_topics: keyTopics,
        updated_at: new Date().toISOString(),
      }, { onConflict: "product_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      throw new Error("Erro ao salvar resumo");
    }

    return new Response(JSON.stringify({ summary, key_topics: keyTopics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("member-extract-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
