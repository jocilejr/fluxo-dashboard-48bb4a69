const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get API settings
    const { data: settings } = await supabase
      .from("messaging_api_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings?.server_url || !settings?.api_key) {
      return new Response(
        JSON.stringify({ success: false, error: "API não configurada" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = settings.server_url.replace(/\/$/, "");
    const apiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.api_key}`,
    };

    // Fetch all reminders from external API (all filters)
    const filters = ['pending', 'overdue', 'today', 'completed'];
    const allReminders: any[] = [];
    const seenIds = new Set<string>();

    for (const filter of filters) {
      try {
        const res = await fetch(`${baseUrl}/api/platform/reminders?filter=${filter}`, {
          method: 'GET',
          headers: apiHeaders,
        });

        if (!res.ok) {
          console.error(`Failed to fetch ${filter}: ${res.status}`);
          const text = await res.text();
          console.error(text.substring(0, 200));
          continue;
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          console.error(`Non-JSON response for ${filter}:`, text.substring(0, 200));
          continue;
        }

        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.data || data?.reminders || [];
        
        for (const item of items) {
          const itemId = item.id || item._id || `${item.phone}-${item.title}-${item.due_date}`;
          if (!seenIds.has(itemId)) {
            seenIds.add(itemId);
            allReminders.push(item);
          }
        }
      } catch (err) {
        console.error(`Error fetching ${filter}:`, err);
      }
    }

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
      const phone = reminder.phone || '';
      const title = reminder.title || '';
      const dueDate = reminder.due_date || reminder.dueDate || null;

      if (!phone || !title || !dueDate) {
        skipped++;
        continue;
      }

      // Check if already exists (by phone + title + due_date combo)
      const { data: existing } = await supabase
        .from("reminders")
        .select("id")
        .eq("phone", phone)
        .eq("title", title)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update if needed
        await supabase
          .from("reminders")
          .update({
            description: reminder.description || null,
            due_date: new Date(dueDate).toISOString(),
            completed: reminder.completed ?? false,
          })
          .eq("id", existing.id);
        skipped++;
      } else {
        // Insert new
        const { error } = await supabase
          .from("reminders")
          .insert({
            phone,
            title,
            description: reminder.description || null,
            due_date: new Date(dueDate).toISOString(),
            completed: reminder.completed ?? false,
          });

        if (error) {
          console.error("Insert error:", error.message);
          skipped++;
        } else {
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
