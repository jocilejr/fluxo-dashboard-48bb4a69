import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Número de telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating phone number: ${phone}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch messaging API settings
    const { data: settings, error: settingsError } = await supabase
      .from('messaging_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: 'API de mensagens não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ error: 'API de mensagens está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = normalizedPhone.slice(1);
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Call external API to validate number via GET /api/platform/contacts/:phone
    const baseUrl = settings.server_url.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/api/platform/contacts/${normalizedPhone}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': settings.api_key,
      },
    });

    console.log(`External API response status: ${response.status}`);

    // Read body as text first to avoid stream consumption issues
    const responseText = await response.text();

    if (response.status === 404) {
      // Contact not found — number doesn't exist in the platform
      return new Response(
        JSON.stringify({ 
          phone: normalizedPhone,
          exists: false,
          isMobile: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.error(`External API error (HTTP ${response.status}): ${responseText.substring(0, 500)}`);
      return new Response(
        JSON.stringify({ error: 'Erro ao validar número', exists: null }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error('External API returned non-JSON response:', responseText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Resposta inválida da API externa', exists: null, details: responseText.substring(0, 200) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        phone: normalizedPhone,
        exists: true,
        isMobile: result.is_mobile ?? null,
        contact: result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating number:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage, exists: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
