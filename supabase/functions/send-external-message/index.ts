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
  customerName?: string;
  amount?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, message, transactionId, abandonedEventId, messageType, customerName, amount }: SendMessageRequest = await req.json();

    console.log(`Sending message to ${phone} via external messaging API`);

    // Get messaging API settings
    const { data: settings, error: settingsError } = await supabase
      .from('messaging_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('Messaging API settings not found:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'API de mensagens não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'API de mensagens está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('message_log')
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

    // Send message via external API
    const apiUrl = `${settings.server_url.replace(/\/$/, '')}/api/send-message`;
    
    console.log(`Calling external API: ${apiUrl}`);

    const externalResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message,
        type: messageType,
        reference_id: transactionId || abandonedEventId || logEntry?.id,
        customer_name: customerName || null,
        amount: amount || null
      })
    });

    const externalData = await externalResponse.json();
    console.log('External API response:', JSON.stringify(externalData));

    // Update log with response
    if (logEntry) {
      const updateData: Record<string, unknown> = {
        external_response: externalData,
        sent_at: new Date().toISOString()
      };

      if (externalResponse.ok && externalData.success) {
        updateData.status = 'sent';
        updateData.external_message_id = externalData.message_id || null;
      } else {
        updateData.status = 'failed';
        updateData.error_message = externalData.error || 'Erro ao enviar mensagem';
      }

      await supabase
        .from('message_log')
        .update(updateData)
        .eq('id', logEntry.id);
    }

    if (!externalResponse.ok || !externalData.success) {
      console.error('External API error:', externalData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: externalData.error || 'Erro ao enviar mensagem',
          details: externalData 
        }),
        { status: externalResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: externalData.message_id,
        response: externalData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-external-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
