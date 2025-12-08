import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaInsights {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  cpc: number;
  ctr: number;
  purchases: number;
  leads: number;
}

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

    // Get ALL active Meta Ads settings
    const { data: allSettings, error: settingsError } = await supabase
      .from("meta_ads_settings")
      .select("*")
      .eq("is_active", true);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      return new Response(JSON.stringify({ error: "Error fetching settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allSettings || allSettings.length === 0) {
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

    console.log(`Fetching Meta Ads insights from ${start} to ${end} for ${allSettings.length} accounts`);

    // Aggregate insights from all accounts
    const aggregated: MetaInsights = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
      cpm: 0,
      cpc: 0,
      ctr: 0,
      purchases: 0,
      leads: 0,
    };

    const accountResults: { name: string; spend: number; error?: string }[] = [];
    let hasExpiredToken = false;

    for (const settings of allSettings) {
      try {
        const adAccountId = settings.ad_account_id.startsWith("act_") 
          ? settings.ad_account_id 
          : `act_${settings.ad_account_id}`;

        const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?` +
          `fields=spend,impressions,clicks,reach,cpm,cpc,ctr,actions` +
          `&time_range={"since":"${start}","until":"${end}"}` +
          `&access_token=${settings.access_token}`;

        const response = await fetch(insightsUrl);
        const data = await response.json();

        if (data.error) {
          console.error(`Meta API error for account ${settings.name}:`, data.error);
          
          if (data.error.code === 190 || data.error.message?.includes("expired")) {
            hasExpiredToken = true;
            accountResults.push({ name: settings.name, spend: 0, error: "Token expirado" });
          } else {
            accountResults.push({ name: settings.name, spend: 0, error: data.error.message });
          }
          continue;
        }

        const insights = data.data?.[0] || {};
        const spend = parseFloat(insights.spend || "0");
        
        aggregated.spend += spend;
        aggregated.impressions += parseInt(insights.impressions || "0");
        aggregated.clicks += parseInt(insights.clicks || "0");
        aggregated.reach += parseInt(insights.reach || "0");
        
        const purchases = insights.actions?.find((a: any) => a.action_type === "purchase")?.value || 0;
        const leads = insights.actions?.find((a: any) => a.action_type === "lead")?.value || 0;
        aggregated.purchases += parseInt(purchases);
        aggregated.leads += parseInt(leads);

        accountResults.push({ name: settings.name, spend });
        console.log(`Account ${settings.name}: R$ ${spend.toFixed(2)}`);
      } catch (error) {
        console.error(`Error fetching account ${settings.name}:`, error);
        accountResults.push({ name: settings.name, spend: 0, error: "Erro de conexão" });
      }
    }

    // Calculate averages for CPM, CPC, CTR
    if (aggregated.impressions > 0) {
      aggregated.cpm = (aggregated.spend / aggregated.impressions) * 1000;
    }
    if (aggregated.clicks > 0) {
      aggregated.cpc = aggregated.spend / aggregated.clicks;
      aggregated.ctr = (aggregated.clicks / aggregated.impressions) * 100;
    }

    const result = {
      configured: true,
      tokenExpired: hasExpiredToken && accountResults.every(a => a.error),
      ...aggregated,
      accounts: accountResults,
      dateRange: { start, end },
    };

    console.log("Meta Ads aggregated insights:", result);

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