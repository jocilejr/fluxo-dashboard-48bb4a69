import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event, data } = await req.json();

    if (!event || !data) {
      return new Response(
        JSON.stringify({ error: "Missing event or data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get webhook_url and api_key from settings
    const { data: settings, error: settingsError } = await supabase
      .from("messaging_api_settings")
      .select("webhook_url, api_key")
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings?.webhook_url) {
      console.log("No webhook_url configured, skipping outbound webhook");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_webhook_url" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    console.log(`Sending outbound webhook: ${event} to ${settings.webhook_url}`);

    const webhookHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (settings.api_key) {
      webhookHeaders["X-API-Key"] = settings.api_key;
    }

    const response = await fetch(settings.webhook_url, {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} - ${responseText}`);
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          error: responseText.substring(0, 200),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Webhook sent successfully: ${event}`);
    return new Response(
      JSON.stringify({ success: true, status: response.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Outbound webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
