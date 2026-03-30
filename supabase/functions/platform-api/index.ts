import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(phone?: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Authenticate via X-API-Key
  const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
  if (!apiKey) {
    return jsonResponse({ error: "Missing X-API-Key header" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Validate API key against messaging_api_settings
  const { data: settings } = await supabase
    .from("messaging_api_settings")
    .select("api_key")
    .maybeSingle();

  if (!settings || settings.api_key !== apiKey) {
    return jsonResponse({ error: "Invalid API key" }, 403);
  }

  // Parse route
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: /platform-api/contacts, /platform-api/contacts/:phone, etc.
  // Remove function name prefix
  const baseParts = pathParts.slice(pathParts.indexOf("platform-api") + 1);
  const resource = baseParts[0] || "";
  const resourceId = baseParts[1] || "";
  const method = req.method;

  try {
    // ─── CONTACTS ────────────────────────────────────────────
    if (resource === "contacts") {
      if (method === "GET" && resourceId) {
        // GET /contacts/:phone - single contact with details
        const phone = normalizePhone(resourceId);
        const phoneLast8 = phone.slice(-8);

        const { data: customer } = await supabase
          .from("customers")
          .select("*")
          .filter("normalized_phone", "ilike", `%${phoneLast8}`)
          .limit(1)
          .maybeSingle();

        if (!customer) return jsonResponse({ error: "Contact not found" }, 404);

        // Get reminders for this contact
        const { data: reminders } = await supabase
          .from("reminders")
          .select("*")
          .filter("phone", "ilike", `%${phoneLast8}`)
          .order("due_date", { ascending: true });

        return jsonResponse({
          contact: customer,
          reminders: reminders || [],
        });
      }

      if (method === "GET") {
        // GET /contacts?phone=&name=&limit=100&offset=0
        const phone = url.searchParams.get("phone");
        const name = url.searchParams.get("name");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);
        const offset = parseInt(url.searchParams.get("offset") || "0");

        let query = supabase
          .from("customers")
          .select("*", { count: "exact" })
          .order("last_seen_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (phone) {
          const phoneLast8 = normalizePhone(phone).slice(-8);
          query = query.filter("normalized_phone", "ilike", `%${phoneLast8}`);
        }
        if (name) {
          query = query.ilike("name", `%${name}%`);
        }

        const { data, count, error } = await query;
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({ data: data || [], count: count || 0, offset, limit });
      }

      if (method === "POST") {
        // POST /contacts - create contact
        const body = await req.json();
        if (!body.phone) return jsonResponse({ error: "phone is required" }, 400);

        const normPhone = normalizePhone(body.phone);
        const { data, error } = await supabase
          .from("customers")
          .upsert(
            {
              normalized_phone: normPhone,
              display_phone: body.phone,
              name: body.name || null,
              email: body.email || null,
              document: body.document || null,
            },
            { onConflict: "normalized_phone" }
          )
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse(data, 201);
      }
    }

    // ─── TRANSACTIONS ────────────────────────────────────────
    if (resource === "transactions") {
      if (method === "GET") {
        const status = url.searchParams.get("status");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const phone = url.searchParams.get("phone");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);
        const offset = parseInt(url.searchParams.get("offset") || "0");

        let query = supabase
          .from("transactions")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (status) query = query.eq("status", status);
        if (from) query = query.gte("created_at", from);
        if (to) query = query.lte("created_at", to);
        if (phone) {
          const phoneLast8 = normalizePhone(phone).slice(-8);
          query = query.filter("normalized_phone", "ilike", `%${phoneLast8}`);
        }

        const { data, count, error } = await query;
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({ data: data || [], count: count || 0, offset, limit });
      }

      if (method === "POST") {
        const body = await req.json();
        if (!body.amount) return jsonResponse({ error: "amount is required" }, 400);

        const normPhone = body.customer_phone ? normalizePhone(body.customer_phone) : null;
        const { data, error } = await supabase
          .from("transactions")
          .insert({
            amount: body.amount,
            type: body.type || "pix",
            status: body.status || "pendente",
            customer_name: body.customer_name || null,
            customer_phone: body.customer_phone || null,
            customer_email: body.customer_email || null,
            customer_document: body.customer_document || null,
            normalized_phone: normPhone,
            description: body.description || null,
            external_id: body.external_id || null,
            paid_at: body.paid_at || null,
            metadata: body.metadata || null,
            webhook_source: "platform_api",
          })
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse(data, 201);
      }

      if (method === "PATCH" && resourceId) {
        const body = await req.json();
        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.status !== undefined) updateData.status = body.status;
        if (body.paid_at !== undefined) updateData.paid_at = body.paid_at;
        if (body.amount !== undefined) updateData.amount = body.amount;
        if (body.customer_name !== undefined) updateData.customer_name = body.customer_name;
        if (body.customer_phone !== undefined) {
          updateData.customer_phone = body.customer_phone;
          updateData.normalized_phone = normalizePhone(body.customer_phone);
        }
        if (body.metadata !== undefined) updateData.metadata = body.metadata;

        const { data, error } = await supabase
          .from("transactions")
          .update(updateData)
          .eq("id", resourceId)
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Transaction not found" }, 404);
        return jsonResponse(data);
      }
    }

    // ─── REMINDERS ───────────────────────────────────────────
    if (resource === "reminders") {
      if (method === "GET") {
        const filter = url.searchParams.get("filter");
        const phone = url.searchParams.get("phone");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);
        const offset = parseInt(url.searchParams.get("offset") || "0");

        let query = supabase
          .from("reminders")
          .select("*", { count: "exact" })
          .order("due_date", { ascending: true })
          .range(offset, offset + limit - 1);

        if (phone) {
          const phoneLast8 = normalizePhone(phone).slice(-8);
          query = query.filter("phone", "ilike", `%${phoneLast8}`);
        }

        const now = new Date().toISOString();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        if (filter === "pending") query = query.eq("completed", false);
        else if (filter === "completed") query = query.eq("completed", true);
        else if (filter === "overdue") query = query.eq("completed", false).lt("due_date", todayStart.toISOString());
        else if (filter === "today") query = query.eq("completed", false).gte("due_date", todayStart.toISOString()).lte("due_date", todayEnd.toISOString());

        const { data, count, error } = await query;
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({ data: data || [], count: count || 0, offset, limit });
      }

      if (method === "POST") {
        const body = await req.json();
        if (!body.phone || !body.title || !body.due_date) {
          return jsonResponse({ error: "phone, title, and due_date are required" }, 400);
        }

        const { data, error } = await supabase
          .from("reminders")
          .insert({
            phone: normalizePhone(body.phone),
            title: body.title,
            description: body.description || null,
            due_date: new Date(body.due_date).toISOString(),
            completed: body.completed || false,
            external_id: body.external_id || null,
          })
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse(data, 201);
      }

      if (method === "PATCH" && resourceId) {
        const body = await req.json();
        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.completed !== undefined) updateData.completed = body.completed;
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.due_date !== undefined) updateData.due_date = new Date(body.due_date).toISOString();
        if (body.phone !== undefined) updateData.phone = body.phone;

        // Try by internal id first, then by external_id
        let data = null;
        let error = null;

        // Check if resourceId looks like a UUID (internal id)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId);

        if (isUUID) {
          const result = await supabase
            .from("reminders")
            .update(updateData)
            .eq("id", resourceId)
            .select()
            .maybeSingle();
          data = result.data;
          error = result.error;
        }

        // If not found by id, try by external_id
        if (!data && !error) {
          const result = await supabase
            .from("reminders")
            .update(updateData)
            .eq("external_id", resourceId)
            .select()
            .maybeSingle();
          data = result.data;
          error = result.error;
        }

        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Reminder not found" }, 404);
        return jsonResponse(data);
      }

      if (method === "DELETE" && resourceId) {
        const { error } = await supabase.from("reminders").delete().eq("id", resourceId);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true });
      }
    }

    // ─── SEND MESSAGE ────────────────────────────────────────
    if (resource === "send-message" && method === "POST") {
      const body = await req.json();
      if (!body.phone || !body.message) {
        return jsonResponse({ error: "phone and message are required" }, 400);
      }

      // Get messaging settings for server_url
      const { data: msgSettings } = await supabase
        .from("messaging_api_settings")
        .select("server_url, api_key, is_active")
        .maybeSingle();

      if (!msgSettings?.is_active || !msgSettings?.server_url) {
        return jsonResponse({ error: "Messaging API not configured or inactive" }, 503);
      }

      // Forward to external messaging API
      try {
        const response = await fetch(`${msgSettings.server_url}/api/sendText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": msgSettings.api_key,
          },
          body: JSON.stringify({
            phone: normalizePhone(body.phone),
            message: body.message,
          }),
        });

        const responseText = await response.text();
        let responseData;
        try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

        // Log the message
        await supabase.from("message_log").insert({
          phone: normalizePhone(body.phone),
          message: body.message,
          message_type: "platform_api",
          status: response.ok ? "sent" : "failed",
          sent_at: response.ok ? new Date().toISOString() : null,
          error_message: response.ok ? null : responseText.substring(0, 200),
          external_response: responseData,
        });

        if (!response.ok) {
          return jsonResponse({ error: "Failed to send message", details: responseData }, 502);
        }

        return jsonResponse({ success: true, response: responseData });
      } catch (err) {
        return jsonResponse({ error: "Failed to connect to messaging API", details: String(err) }, 502);
      }
    }

    // ─── VALIDATE NUMBER ─────────────────────────────────────
    if (resource === "validate-number" && method === "POST") {
      const body = await req.json();
      if (!body.phone) return jsonResponse({ error: "phone is required" }, 400);

      const normPhone = normalizePhone(body.phone);

      // Check cache first
      const { data: cached } = await supabase
        .from("phone_validations")
        .select("*")
        .eq("normalized_phone", normPhone)
        .maybeSingle();

      if (cached) {
        return jsonResponse({
          phone: normPhone,
          exists_on_whatsapp: cached.exists_on_whatsapp,
          jid: cached.jid,
          cached: true,
          validated_at: cached.validated_at,
        });
      }

      // Forward to external API for validation
      const { data: msgSettings } = await supabase
        .from("messaging_api_settings")
        .select("server_url, api_key, is_active")
        .maybeSingle();

      if (!msgSettings?.is_active || !msgSettings?.server_url) {
        return jsonResponse({ error: "Messaging API not configured" }, 503);
      }

      try {
        const response = await fetch(`${msgSettings.server_url}/api/checkNumber`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": msgSettings.api_key,
          },
          body: JSON.stringify({ phone: normPhone }),
        });

        const responseText = await response.text();
        let result;
        try { result = JSON.parse(responseText); } catch { result = {}; }

        const exists = result.exists ?? result.numberExists ?? false;
        const jid = result.jid || result.number || null;

        // Cache result
        await supabase.from("phone_validations").upsert(
          {
            normalized_phone: normPhone,
            exists_on_whatsapp: exists,
            jid,
            validated_at: new Date().toISOString(),
          },
          { onConflict: "normalized_phone" }
        );

        return jsonResponse({
          phone: normPhone,
          exists_on_whatsapp: exists,
          jid,
          cached: false,
        });
      } catch (err) {
        return jsonResponse({ error: "Validation failed", details: String(err) }, 502);
      }
    }

    // ─── PING / HEALTH CHECK ────────────────────────────────
    if (resource === "ping" && method === "GET") {
      return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
    }

    return jsonResponse(
      {
        error: "Not found",
        available_endpoints: [
          "GET /contacts",
          "GET /contacts/:phone",
          "POST /contacts",
          "GET /transactions",
          "POST /transactions",
          "PATCH /transactions/:id",
          "GET /reminders",
          "POST /reminders",
          "PATCH /reminders/:id",
          "DELETE /reminders/:id",
          "POST /send-message",
          "POST /validate-number",
        ],
      },
      404
    );
  } catch (error) {
    console.error("Platform API error:", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
