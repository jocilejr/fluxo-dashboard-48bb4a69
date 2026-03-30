const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { server_url, api_key } = await req.json();

    if (!server_url || !api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'server_url e api_key são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = server_url.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/platform/fetch-instances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': api_key,
        'Authorization': `Bearer ${api_key}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`External API error: ${response.status} - ${errorText.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ success: false, error: `Erro da API externa: ${response.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Unexpected content type: ${contentType}. Body: ${text.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Resposta inesperada da API externa (não é JSON)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify({ success: true, instances: Array.isArray(data) ? data : data.instances || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('fetch-instances error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
