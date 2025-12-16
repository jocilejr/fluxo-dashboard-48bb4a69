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
  if (TEXT_INPUT_TYPES.some(t => lowerType.includes(t))) return true;
  if (BUTTON_TYPES.some(t => lowerType.includes(t))) return false;
  return true;
}

serve(async (req) => {
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

    console.log(`Categorizing responses for typebot: ${typebotName} with ${leads.length} leads`);

    // Collect all text responses
    const allResponses: { leadIndex: number; field: string; value: string }[] = [];
    
    leads.slice(0, 100).forEach((lead: any, index: number) => {
      const answers = lead.answers || [];
      const textAnswers = answers.filter((a: any) => {
        const type = a.type || 'unknown';
        return isTextInput(type);
      });
      
      textAnswers.forEach((a: any) => {
        if (a.value && a.value.trim()) {
          allResponses.push({
            leadIndex: index + 1,
            field: a.key,
            value: a.value.trim()
          });
        }
      });
    });

    if (allResponses.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Nenhum input de texto encontrado nos leads.',
          categories: [],
          responses: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare responses for categorization
    const responsesText = allResponses.map((r, i) => `${i + 1}. "${r.value}"`).join('\n');

    const prompt = `Categorize estas respostas de leads por tipo de assunto/dúvida.

RESPOSTAS:
${responsesText}

Retorne um JSON com este formato EXATO:
{
  "categories": [
    {
      "name": "Nome da categoria",
      "indices": [1, 2, 5, 8]
    }
  ]
}

REGRAS:
1. Cada categoria deve ter um nome curto e descritivo (ex: "Sem dinheiro", "Interesse no produto", "Dúvida técnica")
2. "indices" = números das respostas que pertencem a esta categoria
3. Uma resposta pode pertencer a mais de uma categoria se fizer sentido
4. Ordene por quantidade de respostas (mais frequentes primeiro)
5. Retorne APENAS o JSON, sem texto adicional`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiSettings.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você categoriza respostas. Retorne APENAS JSON válido sem markdown. Português brasileiro.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'API Key da OpenAI inválida.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao categorizar com OpenAI' }),
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

    let parsedData;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      parsedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      // Return raw responses without categorization
      return new Response(
        JSON.stringify({ 
          categories: [],
          responses: allResponses,
          leadsAnalyzed: Math.min(leads.length, 100)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build categorized responses
    const categories = (parsedData.categories || []).map((cat: any) => ({
      name: cat.name,
      count: cat.indices?.length || 0,
      responses: (cat.indices || [])
        .filter((i: number) => i >= 1 && i <= allResponses.length)
        .map((i: number) => allResponses[i - 1])
    })).sort((a: any, b: any) => b.count - a.count);

    console.log(`Categorized ${allResponses.length} responses into ${categories.length} categories`);

    return new Response(
      JSON.stringify({ 
        categories,
        responses: allResponses,
        leadsAnalyzed: Math.min(leads.length, 100),
        totalResponses: allResponses.length
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
