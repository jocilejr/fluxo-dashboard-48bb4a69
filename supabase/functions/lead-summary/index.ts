import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OpenAI API key from database
    const { data: openaiSettings, error: settingsError } = await supabase
      .from('openai_settings')
      .select('api_key')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching OpenAI settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações da OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openaiSettings?.api_key) {
      console.error('OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'API Key da OpenAI não configurada. Configure nas Configurações > OpenAI.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { typebotId, typebotName, leads } = await req.json();

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum lead fornecido para análise' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating summary for typebot: ${typebotName} with ${leads.length} leads`);

    // Prepare lead data for analysis
    const leadsSummary = leads.slice(0, 50).map((lead: any, index: number) => {
      const answers = lead.answers || [];
      const answersText = answers.map((a: any) => `- ${a.key}: ${a.value}`).join('\n');
      return `Lead ${index + 1}:\n${answersText || 'Sem respostas registradas'}`;
    }).join('\n\n');

    const prompt = `Você é um analista de funis de vendas. Analise os dados dos leads do funil "${typebotName}" e me ajude a entender o que está acontecendo dentro do funil.

DADOS DOS LEADS (${leads.length} total, mostrando até 50):
${leadsSummary}

Forneça APENAS uma análise detalhada das DÚVIDAS E OBJEÇÕES dos leads:

1. **Dúvidas Recorrentes (com contagem exata)**
   Liste cada dúvida/objeção mencionada COM O NÚMERO EXATO de leads que falaram sobre isso.
   Formato: "X leads perguntaram/falaram sobre [tema específico]"

2. **O Que Eles Disseram (detalhado)**
   Para cada tema identificado, liste exemplos REAIS do que os leads escreveram.
   Agrupe por categoria e mostre as frases/respostas originais ou resumidas de forma fiel.
   
   Exemplo de formato:
   **Sobre preço/valor:**
   - Lead 1: "Achei caro demais"
   - Lead 5: "Não tenho dinheiro agora"
   - Lead 12: "Quanto custa?"
   
   **Sobre forma de pagamento:**
   - Lead 3: "Aceita PIX?"
   - Lead 7: "Não tenho cartão"

IMPORTANTE: 
- Inclua NÚMEROS EXATOS (ex: "8 leads", não "alguns leads")
- Seja DETALHADO nas respostas dos leads
- Foque no que eles REALMENTE disseram, não em interpretações
- NÃO inclua perfil predominante, recomendações ou sugestões`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiSettings.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um analista de marketing digital experiente, especializado em análise de funis de vendas e comportamento de leads. Responda sempre em português brasileiro.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'API Key da OpenAI inválida. Verifique nas Configurações.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições da OpenAI atingido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao gerar resumo com OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content;

    if (!summary) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Summary generated successfully for ${typebotName}`);

    return new Response(
      JSON.stringify({ 
        summary,
        leadsAnalyzed: Math.min(leads.length, 50),
        totalLeads: leads.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in lead-summary function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
