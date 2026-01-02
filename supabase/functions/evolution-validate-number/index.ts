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
    const { phone } = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Número de telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating phone number: ${phone}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Evolution API settings
    const { data: settings, error: settingsError } = await supabase
      .from('evolution_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('Evolution settings not found:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Evolution API não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ error: 'Evolution API está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    console.log(`Normalized phone: ${normalizedPhone}`);

    // Call Evolution API to check if number exists on WhatsApp
    const evolutionUrl = `${settings.server_url}/chat/whatsappNumbers/${settings.instance_name}`;
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.api_key,
      },
      body: JSON.stringify({
        numbers: [normalizedPhone]
      }),
    });

    const responseText = await response.text();
    console.log(`Evolution API response status: ${response.status}`);
    console.log(`Evolution API response: ${responseText}`);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao validar número', 
          details: responseText,
          exists: null 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ 
          error: 'Resposta inválida da Evolution API', 
          exists: null 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the response - Evolution API returns an array with validation results
    const validationResult = Array.isArray(result) ? result[0] : result;
    const exists = validationResult?.exists === true;
    const jid = validationResult?.jid || null;

    console.log(`Number ${normalizedPhone} exists on WhatsApp: ${exists}`);

    return new Response(
      JSON.stringify({ 
        phone: normalizedPhone,
        exists,
        jid,
        isMobile: normalizedPhone.length >= 12 && normalizedPhone.charAt(4) === '9'
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
