const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REMINDERS_API_URL = "https://api.chatbotsimplificado.com/api/platform/reminders";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get API key from settings
    const { data: settings } = await supabase
      .from("messaging_api_settings")
      .select("api_key")
      .limit(1)
      .maybeSingle();

    if (!settings?.api_key) {
      return new Response(
        JSON.stringify({ success: false, error: "API key não configurada" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': settings.api_key,
    };

    // Fetch all reminders in a single request
    console.log("Fetching reminders from:", REMINDERS_API_URL);
    const res = await fetch(REMINDERS_API_URL, {
      method: 'GET',
      headers: apiHeaders,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`API returned ${res.status}:`, text.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: `API retornou status ${res.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseBody = await res.json();
    console.log("Response keys:", Object.keys(responseBody));

    // Extract reminders from response.data
    const allReminders: any[] = Array.isArray(responseBody)
      ? responseBody
      : responseBody?.data || responseBody?.reminders || [];

    console.log(`Fetched ${allReminders.length} reminders from external API`);

    if (allReminders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, message: "Nenhum lembrete encontrado na API externa" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert reminders into local database
    let imported = 0;
    let skipped = 0;

    for (const reminder of allReminders) {
      const phone = reminder.phone_number || reminder.phone || reminder.remote_jid || '';
      const title = reminder.title || '';
      const dueDate = reminder.due_date || reminder.dueDate || null;
      const contactName = reminder.contact_name || '';

      if (!title || !dueDate) {
        skipped++;
        continue;
      }

      // Use phone or remote_jid, clean it
      const cleanPhone = phone.replace(/[^0-9]/g, '') || 'sem-telefone';

      // Check if already exists
      const { data: existing } = await supabase
        .from("reminders")
        .select("id")
        .eq("phone", phone)
        .eq("title", title)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            description: reminder.description || null,
            due_date: new Date(dueDate).toISOString(),
            completed: reminder.completed ?? false,
          })
          .eq("id", existing.id);
        if (updateError) {
          console.error("Update error:", updateError.message);
        }
        skipped++;
      } else {
        const { data: insertData, error } = await supabase
          .from("reminders")
          .insert({
            phone,
            title,
            description: reminder.description || null,
            due_date: new Date(dueDate).toISOString(),
            completed: reminder.completed ?? false,
          })
          .select("id");

        if (error) {
          console.error("Insert error for", title, ":", error.message, error.details, error.hint);
          skipped++;
        } else {
          console.log("Inserted reminder:", title, insertData);
          imported++;
        }
      }
    }

    console.log(`Import complete: ${imported} new, ${skipped} skipped/updated`);

    return new Response(
      JSON.stringify({ success: true, imported, skipped, total: allReminders.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
