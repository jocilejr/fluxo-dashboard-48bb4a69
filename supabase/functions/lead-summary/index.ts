import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types that represent text inputs (not buttons)
const TEXT_INPUT_TYPES = [
  'text input',
  'email input', 
  'phone input',
  'url input',
  'number input',
  'date input',
  'file input',
  'payment input',
  'rating input',
  'text'
];

// Types that represent button choices (to exclude)
const BUTTON_TYPES = [
  'buttons',
  'choice input',
  'button',
  'picture choice',
  'multiple choice'
];

function isTextInput(type: string): boolean {
  const lowerType = type.toLowerCase();
  // Include if it's a text input type
  if (TEXT_INPUT_TYPES.some(t => lowerType.includes(t))) return true;
  // Exclude if it's a button type
  if (BUTTON_TYPES.some(t => lowerType.includes(t))) return false;
  // Default to include unknown types that aren't buttons
  return true;
}

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

    // Filter only text inputs and prepare lead data for analysis
    const leadsSummary = leads.slice(0, 50).map((lead: any, index: number) => {
      const answers = lead.answers || [];
      // Filter only text inputs (exclude buttons)
      const textAnswers = answers.filter((a: any) => {
        const type = a.type || 'unknown';
        return isTextInput(type);
      });
      
      if (textAnswers.length === 0) return null;
      
      const answersText = textAnswers.map((a: any) => `- ${a.key}: "${a.value}"`).join('\n');
      return `Lead ${index + 1}:\n${answersText}`;
    }).filter(Boolean).join('\n\n');

    if (!leadsSummary || leadsSummary.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Nenhum input de texto encontrado nos leads. Apenas respostas de botões foram detectadas.',
          themes: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Analise os inputs de texto do funil "${typebotName}" com ${leads.length} leads.

DADOS (apenas inputs de texto, sem botões):
${leadsSummary}

Retorne um JSON VÁLIDO com este formato EXATO:
{
  "themes": [
    {
      "name": "Nome do Tema",
      "count": 5,
      "summary": "Resumo analítico do que os leads disseram sobre este tema (2-3 frases explicativas)",
      "quotes": ["frase literal 1", "frase literal 2", "frase literal 3"]
    }
  ]
}

REGRAS OBRIGATÓRIAS:
1. Agrupe as respostas por TEMA similar (ex: dificuldades financeiras, interesse no produto, dúvidas técnicas)
2. "count" = quantidade de leads que mencionaram este tema
3. "summary" = explicação analítica do que os leads disseram (NÃO copiar frases)
4. "quotes" = até 5 frases LITERAIS diferentes e únicas (copiar exatamente como escritas)
5. NÃO inclua frases duplicadas ou muito similares
6. Ordene os temas por "count" (mais mencionados primeiro)
7. Retorne APENAS o JSON, sem texto adicional antes ou depois`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiSettings.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um analista de dados especializado em funis de vendas. Retorne APENAS JSON válido sem markdown ou texto adicional. Responda em português brasileiro.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.3,
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
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OpenAI raw response:', content);

    // Try to parse JSON from the response
    let parsedData;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      parsedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing OpenAI response as JSON:', parseError);
      console.error('Content was:', content);
      
      // Return as legacy text format if JSON parsing fails
      return new Response(
        JSON.stringify({ 
          summary: content,
          leadsAnalyzed: Math.min(leads.length, 50),
          totalLeads: leads.length,
          themes: null // Indicates legacy format
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Summary generated successfully for ${typebotName} with ${parsedData.themes?.length || 0} themes`);

    return new Response(
      JSON.stringify({ 
        themes: parsedData.themes || [],
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
