const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function getApiSettings() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await supabase.from("messaging_api_settings").select("*").limit(1).maybeSingle();
  if (!data?.server_url || !data?.api_key) throw new Error("API não configurada");
  return { baseUrl: data.server_url.replace(/\/$/, ""), apiKey: data.api_key };
}

async function safeJsonParse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("Non-JSON response:", text.substring(0, 500));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, apiKey } = await getApiSettings();
    const body = await req.json();
    const { action } = body;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // LIST reminders
    if (action === 'list') {
      const params = new URLSearchParams();
      if (body.filter) params.set('filter', body.filter);
      if (body.phone) params.set('phone', body.phone);
      const url = `${baseUrl}/api/platform/reminders${params.toString() ? '?' + params.toString() : ''}`;
      console.log("Fetching:", url);
      const res = await fetch(url, { method: 'GET', headers });
      const data = await safeJsonParse(res);
      if (data === null) {
        return new Response(JSON.stringify({ success: false, error: `API retornou status ${res.status} com resposta não-JSON` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: res.ok, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CREATE reminder
    if (action === 'create') {
      const res = await fetch(`${baseUrl}/api/platform/reminders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: body.phone,
          title: body.title,
          description: body.description,
          due_date: body.due_date,
        }),
      });
      const data = await safeJsonParse(res);
      if (data === null) {
        return new Response(JSON.stringify({ success: false, error: `API retornou status ${res.status} com resposta não-JSON` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: res.ok, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UPDATE reminder
    if (action === 'update') {
      const res = await fetch(`${baseUrl}/api/platform/reminders/${body.reminder_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          completed: body.completed,
          title: body.title,
          due_date: body.due_date,
        }),
      });
      const data = await safeJsonParse(res);
      if (data === null) {
        return new Response(JSON.stringify({ success: false, error: `API retornou status ${res.status} com resposta não-JSON` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: res.ok, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida. Use: list, create, update' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
