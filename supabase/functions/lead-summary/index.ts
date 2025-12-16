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

    const prompt = `Você é um analista de marketing digital especializado em funis de vendas. Analise os dados dos leads do funil "${typebotName}" e forneça um resumo executivo em português.

DADOS DOS LEADS (${leads.length} total, mostrando até 50):
${leadsSummary}

Forneça uma análise QUANTITATIVA contendo:

1. **Pontos de Referência com Contagens** - Liste os principais temas/objeções mencionados pelos leads COM NÚMEROS EXATOS. Exemplos de formato:
   - "X leads mencionaram dificuldades financeiras"
   - "Y leads disseram não ter cartão de crédito"
   - "Z leads demonstraram interesse mas pediram mais informações"
   - "W leads abandonaram por motivo X"
   
2. **Perfil predominante** - características mais comuns (com percentuais quando possível)

3. **Principais objeções/barreiras** - liste as mais frequentes com contagem

4. **Recomendações** - 2-3 ações práticas baseadas nos dados

IMPORTANTE: Sempre inclua números específicos (ex: "12 leads", "35% dos leads"). Não seja vago. Analise cada resposta e agrupe por temas similares para contar.`;

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
