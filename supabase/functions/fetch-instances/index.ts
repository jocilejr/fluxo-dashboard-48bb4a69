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
    
    const urlsToTry = [baseUrl];
    if (baseUrl.includes('://app.')) {
      urlsToTry.push(baseUrl.replace('://app.', '://api.'));
    }

    for (const url of urlsToTry) {
      try {
        console.log(`Trying URL: ${url}/api/platform/instances`);
        const response = await fetch(`${url}/api/platform/instances`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': api_key,
          },
        });

        console.log(`Response status: ${response.status}, content-type: ${response.headers.get('content-type')}`);

        if (!response.ok) {
          const body = await response.text();
          console.error(`Non-OK response (${response.status}): ${body.substring(0, 500)}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const body = await response.text();
          console.error(`Unexpected content type: ${contentType}. Body: ${body.substring(0, 500)}`);
          continue;
        }

        const data = await response.json();
        console.log('API response data:', JSON.stringify(data));
        const instances = Array.isArray(data) ? data : data.instances || data.data || data.results || [];
        return new Response(
          JSON.stringify({ success: true, instances }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error(`Fetch error for ${url}:`, err);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Não foi possível buscar instâncias da API externa' }),
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
