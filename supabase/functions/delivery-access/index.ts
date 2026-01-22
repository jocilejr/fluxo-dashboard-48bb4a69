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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { slug, phone } = await req.json();

    if (!slug || !phone) {
      return new Response(
        JSON.stringify({ error: "slug and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove non-digits)
    const normalizedPhone = phone.replace(/\D/g, "");

    console.log(`[delivery-access] Processing access for slug: ${slug}, phone: ${normalizedPhone}`);

    // Get product by slug
    const { data: product, error: productError } = await supabase
      .from("delivery_products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (productError || !product) {
      console.error("[delivery-access] Product not found:", productError);
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get global pixels
    const { data: globalPixels } = await supabase
      .from("global_delivery_pixels")
      .select("*")
      .eq("is_active", true);

    // Get global settings for fallback redirect URL
    const { data: globalSettings } = await supabase
      .from("delivery_settings")
      .select("global_redirect_url")
      .limit(1)
      .maybeSingle();

    // Check if phone already accessed this product
    const { data: existingAccess } = await supabase
      .from("delivery_accesses")
      .select("*")
      .eq("product_id", product.id)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    // Use product redirect_url, fallback to global
    const redirectUrl = product.redirect_url || globalSettings?.global_redirect_url || "";

    if (existingAccess) {
      console.log(`[delivery-access] Phone ${normalizedPhone} already accessed product ${product.name}`);
      return new Response(
        JSON.stringify({
          already_accessed: true,
          redirect_url: redirectUrl,
          product: {
            name: product.name,
            page_title: product.page_title,
            page_message: product.page_message,
            page_logo: product.page_logo,
            redirect_delay: product.redirect_delay,
            value: product.value || 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First time access - register it
    const { error: insertError } = await supabase
      .from("delivery_accesses")
      .insert({
        product_id: product.id,
        phone: normalizedPhone,
        pixel_fired: true,
        webhook_sent: !!product.delivery_webhook_url,
      });

    if (insertError) {
      console.error("[delivery-access] Error inserting access:", insertError);
    }

    // Use global pixels
    const activePixels = (globalPixels || []);

    // Log pixel fires to the database
    if (activePixels.length > 0) {
      const pixelsData = activePixels.map((p: any) => ({
        platform: p.platform,
        pixel_id: p.pixel_id,
        event_name: p.event_name,
      }));

      const { error: pixelLogError } = await supabase
        .from("pixel_fire_logs")
        .insert({
          product_id: product.id,
          product_name: product.name,
          phone: normalizedPhone,
          pixels_fired: pixelsData,
          product_value: product.value || 0,
        });

      if (pixelLogError) {
        console.error("[delivery-access] Error logging pixel fires:", pixelLogError);
      } else {
        console.log(`[delivery-access] Logged ${activePixels.length} pixels for ${normalizedPhone}`);
      }
    }

    // Send delivery webhook if configured
    if (product.delivery_webhook_url) {
      try {
        const webhookPayload = {
          telefone: normalizedPhone,
          produto: product.name,
          produto_slug: product.slug,
        };

        console.log(`[delivery-access] Sending delivery webhook to: ${product.delivery_webhook_url}`);
        
        const webhookResponse = await fetch(product.delivery_webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        console.log(`[delivery-access] Webhook response status: ${webhookResponse.status}`);
      } catch (webhookError) {
        console.error("[delivery-access] Webhook error:", webhookError);
      }
    }

    console.log(`[delivery-access] First access for ${normalizedPhone}, returning ${activePixels.length} global pixels`);

    return new Response(
      JSON.stringify({
        already_accessed: false,
        redirect_url: redirectUrl,
        pixels: activePixels.map((p: any) => ({
          platform: p.platform,
          pixel_id: p.pixel_id,
          event_name: p.event_name,
        })),
        product: {
          name: product.name,
          page_title: product.page_title,
          page_message: product.page_message,
          page_logo: product.page_logo,
          redirect_delay: product.redirect_delay,
          value: product.value || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[delivery-access] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
