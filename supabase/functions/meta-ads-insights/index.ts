import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Meta Ads settings
    const { data: settings, error: settingsError } = await supabase
      .from("meta_ads_settings")
      .select("*")
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      return new Response(JSON.stringify({ error: "Error fetching settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings) {
      return new Response(JSON.stringify({ error: "Meta Ads not configured", configured: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for date range
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate } = body;
    
    // Default to today if no dates provided
    const today = new Date().toISOString().split("T")[0];
    const start = startDate || today;
    const end = endDate || today;

    // Fetch insights from Meta Ads API
    const adAccountId = settings.ad_account_id.startsWith("act_") 
      ? settings.ad_account_id 
      : `act_${settings.ad_account_id}`;

    const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?` +
      `fields=spend,impressions,clicks,reach,cpm,cpc,ctr,actions` +
      `&time_range={"since":"${start}","until":"${end}"}` +
      `&access_token=${settings.access_token}`;

    console.log(`Fetching Meta Ads insights from ${start} to ${end}`);

    const response = await fetch(insightsUrl);
    const data = await response.json();

    if (data.error) {
      console.error("Meta API error:", data.error);
      
      // Check for expired token
      if (data.error.code === 190 || data.error.message?.includes("expired")) {
        return new Response(JSON.stringify({ 
          error: "Token expirado. Gere um novo token no Meta Business Suite.",
          tokenExpired: true,
          configured: true
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        error: data.error.message || "Erro na API do Meta",
        configured: true
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse insights data
    const insights = data.data?.[0] || {};
    
    // Find purchase conversions
    const purchases = insights.actions?.find((a: any) => a.action_type === "purchase")?.value || 0;
    const leads = insights.actions?.find((a: any) => a.action_type === "lead")?.value || 0;

    const result = {
      configured: true,
      spend: parseFloat(insights.spend || "0"),
      impressions: parseInt(insights.impressions || "0"),
      clicks: parseInt(insights.clicks || "0"),
      reach: parseInt(insights.reach || "0"),
      cpm: parseFloat(insights.cpm || "0"),
      cpc: parseFloat(insights.cpc || "0"),
      ctr: parseFloat(insights.ctr || "0"),
      purchases: parseInt(purchases),
      leads: parseInt(leads),
      dateRange: { start, end },
    };

    console.log("Meta Ads insights fetched successfully:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in meta-ads-insights:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
