import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestConnectionRequest {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { serverUrl, apiKey, instanceName }: TestConnectionRequest = await req.json();

    console.log(`Testing Evolution API connection: ${serverUrl}`);

    // Test connection by fetching instance info
    const evolutionUrl = `${serverUrl.replace(/\/$/, '')}/instance/connectionState/${instanceName}`;
    
    const response = await fetch(evolutionUrl, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    const data = await response.json();
    console.log('Evolution API response:', JSON.stringify(data));

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.message || 'Erro ao conectar com Evolution API',
          details: data
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check connection state
    const isConnected = data.instance?.state === 'open' || data.state === 'open';

    return new Response(
      JSON.stringify({ 
        success: true, 
        connected: isConnected,
        state: data.instance?.state || data.state || 'unknown',
        details: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error testing Evolution connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
