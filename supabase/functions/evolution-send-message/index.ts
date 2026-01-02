import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  phone: string;
  message: string;
  transactionId?: string;
  abandonedEventId?: string;
  messageType: 'boleto' | 'pix_card' | 'abandoned';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, message, transactionId, abandonedEventId, messageType }: SendMessageRequest = await req.json();

    console.log(`Sending message to ${phone} via Evolution API`);

    // Get Evolution API settings
    const { data: settings, error: settingsError } = await supabase
      .from('evolution_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('Evolution API settings not found:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number (remove non-digits, ensure starts with country code)
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('evolution_message_log')
      .insert({
        phone: normalizedPhone,
        message,
        message_type: messageType,
        transaction_id: transactionId || null,
        abandoned_event_id: abandonedEventId || null,
        status: 'pending'
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating log entry:', logError);
    }

    // Send message via Evolution API
    const evolutionUrl = `${settings.server_url.replace(/\/$/, '')}/message/sendText/${settings.instance_name}`;
    
    console.log(`Calling Evolution API: ${evolutionUrl}`);

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.api_key
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message
      })
    });

    const evolutionData = await evolutionResponse.json();
    console.log('Evolution API response:', JSON.stringify(evolutionData));

    // Update log with response
    if (logEntry) {
      const updateData: Record<string, unknown> = {
        evolution_response: evolutionData,
        sent_at: new Date().toISOString()
      };

      if (evolutionResponse.ok) {
        updateData.status = 'sent';
      } else {
        updateData.status = 'failed';
        updateData.error_message = evolutionData.message || 'Erro ao enviar mensagem';
      }

      await supabase
        .from('evolution_message_log')
        .update(updateData)
        .eq('id', logEntry.id);
    }

    if (!evolutionResponse.ok) {
      console.error('Evolution API error:', evolutionData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: evolutionData.message || 'Erro ao enviar mensagem',
          details: evolutionData 
        }),
        { status: evolutionResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: evolutionData.key?.id,
        response: evolutionData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evolution-send-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
