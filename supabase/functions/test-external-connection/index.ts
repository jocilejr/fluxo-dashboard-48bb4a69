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

    // Try multiple health check paths in order of preference
    const paths = [
      '/ping',
      '/api/platform/ping',
      '/contacts?limit=1',
      '/api/platform/contacts?limit=1',
    ];

    let lastResponse: Response | null = null;
    let lastError: string | null = null;

    for (const path of paths) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': api_key,
            'Authorization': `Bearer ${api_key}`,
          },
        });

        if (response.ok) {
          return new Response(
            JSON.stringify({ success: true, status: response.status, path }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        lastResponse = response;
        lastError = await response.text();
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        status: lastResponse?.status || 0,
        error: `Nenhum endpoint respondeu. Último erro: ${lastError?.substring(0, 200)}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
