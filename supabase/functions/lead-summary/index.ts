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

    console.log(`Processing ${leads.length} leads for typebot: ${typebotName}`);

    // Group responses by lead, extracting phone if available
    interface LeadData {
      id: string;
      phone: string | null;
      createdAt: string | null;
      responses: { field: string; question: string | null; value: string }[];
    }
    
    const leadsData: LeadData[] = [];
    const allTextResponses: string[] = [];
    
    leads.slice(0, 100).forEach((lead: any, index: number) => {
      const answers = lead.answers || [];
      const textAnswers = answers.filter((a: any) => {
        const type = a.type || 'unknown';
        return isTextInput(type);
      });
      
      // Try to find phone in answers
      let phone: string | null = null;
      const phoneAnswer = answers.find((a: any) => 
        a.type?.toLowerCase().includes('phone') || 
        a.key?.toLowerCase().includes('telefone') ||
        a.key?.toLowerCase().includes('phone') ||
        a.key?.toLowerCase().includes('whatsapp') ||
        a.key?.toLowerCase().includes('celular')
      );
      if (phoneAnswer?.value) {
        phone = phoneAnswer.value;
      }
      
      const responses: { field: string; question: string | null; value: string }[] = [];
      textAnswers.forEach((a: any) => {
        if (a.value && a.value.trim()) {
          responses.push({ 
            field: a.key, 
            question: a.question || null,
            value: a.value.trim() 
          });
          allTextResponses.push(a.value.trim());
        }
      });
      
      if (responses.length > 0) {
        leadsData.push({
          id: lead.id || `lead-${index + 1}`,
          phone,
          createdAt: lead.createdAt || null,
          responses
        });
      }
    });

    if (leadsData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Nenhum input de texto encontrado nos leads.',
          categories: [],
          leads: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare text for categorization
    const responsesText = allTextResponses.map((r, i) => `${i + 1}. "${r}"`).join('\n');

    const prompt = `Identifique os principais tipos de dúvidas/respostas recorrentes nestas respostas de leads.

RESPOSTAS:
${responsesText}

Retorne um JSON com este formato EXATO:
{
  "categories": [
    { "name": "Nome curto da categoria", "count": 5 }
  ]
}

REGRAS:
1. Identifique padrões e agrupe por tema/assunto
2. "count" = quantas respostas mencionam este tema
3. Máximo 8 categorias mais relevantes
4. Ordene por count (mais frequentes primeiro)
5. Nomes curtos e descritivos (ex: "Sem dinheiro", "Interesse no produto")
6. Retorne APENAS o JSON`;

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
        max_tokens: 500,
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
      
      // Return leads without categories on error
      return new Response(
        JSON.stringify({ 
          categories: [],
          leads: leadsData,
          leadsAnalyzed: leadsData.length,
          totalResponses: allTextResponses.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    let categories: { name: string; count: number }[] = [];
    
    if (content) {
      try {
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        const parsedData = JSON.parse(cleanContent);
        categories = (parsedData.categories || []).slice(0, 8);
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
      }
    }

    console.log(`Processed ${leadsData.length} leads with ${categories.length} categories`);

    return new Response(
      JSON.stringify({ 
        categories,
        leads: leadsData,
        leadsAnalyzed: leadsData.length,
        totalResponses: allTextResponses.length
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
