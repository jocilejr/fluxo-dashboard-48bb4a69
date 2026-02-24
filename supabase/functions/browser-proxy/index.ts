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
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[browser-proxy] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
    });

    let html = await response.text();
    const finalUrl = response.url || url;

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Get base URL for rewriting relative URLs
    const baseUrl = new URL(finalUrl);
    const origin = baseUrl.origin;
    const basePath = baseUrl.pathname.replace(/\/[^/]*$/, "/");

    // Add base tag for relative URLs
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${origin}${basePath}">`
    );

    // Rewrite relative URLs in src and href attributes
    html = html.replace(
      /(src|href|action)=(["'])(\/[^/"'])/gi,
      `$1=$2${origin}$3`
    );

    // Remove X-Frame-Options and CSP meta tags
    html = html.replace(
      /<meta[^>]*http-equiv=["'](?:X-Frame-Options|Content-Security-Policy)["'][^>]*>/gi,
      ""
    );

    return new Response(JSON.stringify({ html, title, finalUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[browser-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch page" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
