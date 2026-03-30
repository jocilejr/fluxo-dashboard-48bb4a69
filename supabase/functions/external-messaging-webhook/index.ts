import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('External messaging webhook received:', JSON.stringify(payload));

    const { event } = payload;

    if (event === 'message_status') {
      const { message_id, reference_id, status, error: errorMsg } = payload;

      if (!message_id && !reference_id) {
        return new Response(
          JSON.stringify({ error: 'message_id or reference_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update message log
      const updateData: Record<string, unknown> = { status };
      if (errorMsg) updateData.error_message = errorMsg;
      if (status === 'sent' || status === 'delivered') updateData.sent_at = new Date().toISOString();

      let query = supabase.from('message_log').update(updateData);
      
      if (message_id) {
        query = query.eq('external_message_id', message_id);
      } else if (reference_id) {
        query = query.eq('id', reference_id);
      }

      const { error } = await query;
      if (error) {
        console.error('Error updating message log:', error);
      }

      return new Response(
        JSON.stringify({ success: true, action: 'status_updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (event === 'customer_reply') {
      const { phone, message, timestamp } = payload;

      console.log(`Customer reply from ${phone}: ${message}`);

      // Could store replies in a future table or trigger notifications
      return new Response(
        JSON.stringify({ success: true, action: 'reply_received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown event type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in external-messaging-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
